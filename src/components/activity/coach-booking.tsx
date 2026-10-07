'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { addDays, addMinutes, format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, BadgeCheck, CalendarDays, Check, CheckCircle2, Clock, GraduationCap, Loader2, MapPin,
  Phone, QrCode, RotateCcw, Star, UploadCloud, User, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { apiUrl } from '@/lib/api'
import { getSlotPrice, type PriceRule } from '@/lib/price'
import { isSlotPassed } from '@/lib/slot-time'
import { generatePromptPayQR } from '@/components/qrcode'
import { COACH_ADVANCE_DAYS, COACH_PACKAGES, COACH_SLOT_TIMES } from './coaches'
import { MAX_SLIP_SIZE } from '@/components/dashboard/slip-helpers'

/** ชื่อวันแบบสั้น — ใช้บนจอแคบ (แถบวัน 7 คอลัมน์) */
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const STEPS = ['แพ็กเกจโค้ช', 'วันและเวลา', 'สรุปและชำระเงิน', 'จองสำเร็จ']

/** สนามจริงจาก /api/courts */
interface CourtOption {
  id: string
  name: string
  pricePerHour: number
  isActive: boolean
  sortOrder: number
}

/** แถวการจองสนามของวันนั้น (จาก /api/bookings?date=) */
interface DayBooking {
  courtId: string
  status: string
  timeSlot?: { startTime: string }
}

/** แถวการจองโค้ชของวันนั้น (จาก /api/coach-bookings?date=) */
interface DayCoachBooking {
  coachId: string
  startTimes: string
  status: string
}

/** ผลลัพธ์หลังบันทึกจริง (จาก POST /api/coach-bookings) */
interface CoachBookingResult {
  id: string
  ticketCode?: string | null
  coachName: string
  courtName: string
  bookingDate: string
  startTimes: string
  hours: number
  courtTotal: number
  coachTotal: number
  totalPrice: number
  status: string
}

/** "฿600" — รูปแบบราคาเดียวกับหน้าจองสนาม */
function thb(amount: number): string {
  return `฿${amount.toLocaleString()}`
}

/** เวลาสิ้นสุดของช่วง 1 ชั่วโมง เช่น "09:00" -> "10:00" */
function slotEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  return format(addMinutes(new Date(2000, 0, 1, h, m, 0), 60), 'HH:mm')
}

/** แสดงวันที่แบบไทย เช่น "25 ก.ย." */
function thaiDate(value: string): string {
  return format(new Date(`${value}T00:00:00`), 'd MMM', { locale: th })
}

/** แสดงช่วงเวลาแบบอ่านง่าย เช่น "09:00–10:00, 13:00–14:00" */
function thaiTimeRange(times: string[]): string {
  return times.map((t) => `${t}–${slotEndTime(t)}`).join(', ')
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center px-2" aria-label="ขั้นตอนการจองโค้ช">
      {STEPS.map((label, i) => {
        const n = i + 1
        const isDone = current > n
        const isCurrent = current === n
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ' +
                  (isCurrent
                    ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                    : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground')
                }
              >
                {isDone ? <Check className="h-4 w-4" /> : n}
              </div>
              <span
                className={
                  'mt-1.5 text-[11px] font-medium ' +
                  (isCurrent || isDone ? 'text-emerald-600' : 'text-muted-foreground')
                }
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={'mx-1 mb-4 h-0.5 flex-1 ' + (isDone ? 'bg-emerald-500' : 'bg-muted')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

/**
 * จองโค้ช (จริง) — flow: เลือกแพ็กเกจโค้ช → เลือกวัน/เวลา/สนาม → สรุปและชำระเงิน → จองสำเร็จ
 * ยอดชำระ = ค่าสนาม (ราคาของวันนั้น) + ค่าโค้ช → ส่งสลิป → บันทึกลงฐานข้อมูลจริง (รอเจ้าหน้าที่ตรวจสอบ)
 */
export function CoachBooking() {
  const router = useRouter()
  const [now] = useState(() => new Date())
  const [step, setStep] = useState(1)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [date, setDate] = useState(() => format(now, 'yyyy-MM-dd'))
  const [courtId, setCourtId] = useState('')
  const [times, setTimes] = useState<string[]>([])

  // ข้อมูลจริงจาก API (สนาม / ราคา / คิวของวันนั้น)
  const [courts, setCourts] = useState<CourtOption[]>([])
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [dayBookings, setDayBookings] = useState<DayBooking[]>([])
  const [dayCoachBookings, setDayCoachBookings] = useState<DayCoachBooking[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // ผู้จอง / สลิป / การชำระเงิน
  const [form, setForm] = useState({ playerName: '', playerPhone: '', playerEmail: '', note: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [slip, setSlip] = useState<{ dataUrl: string; name: string; size: number } | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [paid, setPaid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<CoachBookingResult | null>(null)

  const days = useMemo(
    () => Array.from({ length: COACH_ADVANCE_DAYS + 1 }, (_, i) => addDays(now, i)),
    [now]
  )
  const coach = COACH_PACKAGES.find((c) => c.id === coachId) ?? null
  const court = courts.find((c) => c.id === courtId) ?? null
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay()

  // สนาม + ช่วงราคา (โหลดครั้งเดียว)
  useEffect(() => {
    let active = true
    Promise.all([
      fetch(apiUrl('/api/courts')).then((r) => r.json()),
      fetch(apiUrl('/api/pricerules')).then((r) => r.json()),
    ])
      .then(([courtsData, rulesData]) => {
        if (!active) return
        if (Array.isArray(courtsData)) {
          const list = (courtsData as CourtOption[])
            .filter((c) => c.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          setCourts(list)
          if (list.length > 0) setCourtId((prev) => prev || list[0].id)
        }
        if (Array.isArray(rulesData)) setPriceRules(rulesData as PriceRule[])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // คิวของวันนั้น — สนาม (Booking) + โค้ช (CoachBooking) เพื่อปิดช่วงเวลาที่ไม่ว่าง
  useEffect(() => {
    let active = true
    setSlotsLoading(true)
    Promise.all([
      fetch(apiUrl(`/api/bookings?date=${date}`)).then((r) => r.json()),
      fetch(apiUrl(`/api/coach-bookings?date=${date}`)).then((r) => r.json()),
    ])
      .then(([bookingsData, coachData]) => {
        if (!active) return
        setDayBookings(Array.isArray(bookingsData) ? (bookingsData as DayBooking[]) : [])
        setDayCoachBookings(Array.isArray(coachData) ? (coachData as DayCoachBooking[]) : [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSlotsLoading(false)
      })
    return () => {
      active = false
    }
  }, [date])

  /** ช่วงเวลาที่สนามที่เลือกถูกจองแล้วในวันนั้น */
  const busyCourtSlots = useMemo(() => {
    const set = new Set<string>()
    for (const b of dayBookings) {
      if (b.status === 'cancelled') continue
      set.add(`${b.courtId}|${b.timeSlot?.startTime ?? ''}`)
    }
    return set
  }, [dayBookings])

  /** ช่วงเวลาที่โค้ชแต่ละคนมีคิวแล้วในวันนั้น */
  const busyCoachSlots = useMemo(() => {
    const set = new Set<string>()
    for (const b of dayCoachBookings) {
      if (b.status === 'cancelled') continue
      for (const t of String(b.startTimes ?? '').split(',')) set.add(`${b.coachId}|${t.trim()}`)
    }
    return set
  }, [dayCoachBookings])

  /** ราคาสนามต่อชั่วโมงของวันนั้น (ตาม PriceRule) */
  const courtPriceFor = (t: string) => (court ? getSlotPrice(court.pricePerHour, dayOfWeek, t, priceRules) : 0)
  const courtTotal = court ? times.reduce((sum, t) => sum + courtPriceFor(t), 0) : 0
  const coachTotal = coach ? coach.pricePerHour * times.length : 0
  const total = courtTotal + coachTotal

  const pickCoach = (id: string) => {
    setCoachId(id)
    setTimes([])
  }

  const pickDay = (value: string) => {
    setDate(value)
    setTimes([])
  }

  const pickCourt = (id: string) => {
    setCourtId(id)
    setTimes([])
  }

  const toggleTime = (t: string) => {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()))
  }

  const reset = () => {
    setStep(1)
    setCoachId(null)
    setTimes([])
    setResult(null)
    setPaid(false)
    setQrDataUrl(null)
    setSlip(null)
    setSlipError(null)
    setForm({ playerName: '', playerPhone: '', playerEmail: '', note: '' })
    setFormErrors({})
    setSubmitError(null)
    setDate(format(now, 'yyyy-MM-dd'))
  }

  const handleSlipChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setSlipError(null)
    setSubmitError(null)
    if (!file) return

    const isJpg = file.type === 'image/jpeg'
    const isPng = file.type === 'image/png'
    if (!isJpg && !isPng) {
      setSlipError('รองรับเฉพาะไฟล์ .jpg หรือ .png เท่านั้น')
      e.target.value = ''
      return
    }
    if (file.size > MAX_SLIP_SIZE) {
      setSlipError(`ไฟล์ใหญ่เกินไป (สูงสุด 300kB) — ไฟล์นี้ ${Math.ceil(file.size / 1024)}kB`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () =>
      setSlip({ dataUrl: String(reader.result), name: file.name, size: file.size })
    reader.readAsDataURL(file)
  }

  const handleRemoveSlip = () => {
    setSlip(null)
    setSlipError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /** ตรวจข้อมูลผู้จอง + สลิป ก่อนไปขั้นจ่ายเงิน */
  const validateBeforePay = () => {
    const errs: Record<string, string> = {}
    if (!form.playerName.trim()) errs.playerName = 'กรุณากรอกชื่อผู้จอง'
    if (!form.playerPhone.trim()) {
      errs.playerPhone = 'กรุณากรอกเบอร์โทร'
    } else if (!/^\d{9,10}$/.test(form.playerPhone.replace(/[-\s]/g, ''))) {
      errs.playerPhone = 'เบอร์โทรไม่ถูกต้อง (10 หลัก)'
    }
    if (!slip) errs.slip = 'กรุณาแนบสลิปการชำระเงิน'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleProceed = async () => {
    if (!coach || !court || times.length === 0) return
    if (!validateBeforePay()) return
    setQrOpen(true)
    setPaid(false)
    setSubmitError(null)
    setQrLoading(true)
    setQrDataUrl(null)
    try {
      setQrDataUrl(await generatePromptPayQR(total))
    } catch (err) {
      console.error('Failed to generate QR', err)
    } finally {
      setQrLoading(false)
    }
  }

  /** กด "ชำระเงินแล้ว" → บันทึกการจองจริงลงฐานข้อมูล (รอเจ้าหน้าที่ตรวจสลิป) */
  const handleConfirmPaid = async () => {
    if (!coach || !court || !slip) return
    setPaid(true)
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(apiUrl('/api/coach-bookings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: coach.id,
          courtId: court.id,
          bookingDate: date,
          startTimes: times,
          playerName: form.playerName,
          playerPhone: form.playerPhone,
          playerEmail: form.playerEmail || undefined,
          note: form.note || undefined,
          slipName: slip.name,
          slipDataUrl: slip.dataUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPaid(false)
        setSubmitError(data?.error || 'บันทึกการจองไม่สำเร็จ กรุณาลองใหม่')
        return
      }
      setResult(data as CoachBookingResult)
      setQrOpen(false)
      setStep(4)
    } catch {
      setPaid(false)
      setSubmitError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const bookedTimes = String(result.startTimes ?? '').split(',').map((t) => t.trim()).filter(Boolean)
    return (
      <div className="space-y-3">
        <Stepper current={4} />
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-6 text-center">
          <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" />
          <div>
            <p className="text-lg font-semibold">จองโค้ชสำเร็จ</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {result.coachName} • {result.courtName} • {thaiDate(result.bookingDate)} • {result.hours} ชม.
            </p>
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground">รหัสตั๋ว</p>
            <p className="font-mono text-base font-semibold tracking-[0.25em] text-emerald-700">
              {result.ticketCode ?? '-'}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">{thaiTimeRange(bookedTimes)}</p>

          <dl className="space-y-1.5 rounded-xl border bg-white p-3 text-left text-sm">
            <SummaryRow label={`ค่าสนาม (${result.hours} ชม.)`} value={thb(result.courtTotal)} />
            <SummaryRow label={`ค่าโค้ช (${result.hours} ชม.)`} value={thb(result.coachTotal)} />
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium">ยอดชำระรวม</span>
              <span className="text-xl font-bold text-emerald-700">{thb(result.totalPrice)}</span>
            </div>
          </dl>

          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            บันทึกการจองในระบบแล้ว — เจ้าหน้าที่จะตรวจสอบสลิปการชำระเงินและยืนยันการจองให้อีกครั้ง
          </p>

          <Button variant="outline" className="w-full" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            จองโค้ชเพิ่ม
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Stepper current={step} />

      <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
        <GraduationCap className="h-4 w-4 shrink-0" />
        <span>
          ยอดชำระรวมค่าสนาม + ค่าโค้ช • ค่าโค้ช {thb(600)} หรือ {thb(800)} ต่อชั่วโมง • ค่าสนามคิดตามราคาของวันนั้น
          แล้วส่งสลิปเพื่อให้เจ้าหน้าที่ตรวจสอบ
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COACH_PACKAGES.map((c) => {
              const active = c.id === coachId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCoach(c.id)}
                  aria-pressed={active}
                  className={
                    'flex flex-col gap-2 rounded-2xl border bg-white p-4 text-left transition-all ' +
                    (active ? 'border-emerald-500 ring-2 ring-emerald-200' : 'hover:border-emerald-300')
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                      {c.initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{c.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                        {c.level} • ประสบการณ์ {c.experienceYears} ปี
                      </p>
                    </div>
                    {active && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {c.specialties.map((s) => (
                      <span key={s} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      ว่าง {c.availableDays}
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {c.rating.toFixed(1)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-end justify-between border-t pt-2">
                    <span className="text-xs text-muted-foreground">ราคา/ชั่วโมง</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {thb(c.pricePerHour)}
                      <span className="text-xs font-medium text-muted-foreground">/ชม.</span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <Button
            onClick={() => {
              if (!coach) return
              // ไปเลือกวัน–เวลา บนหน้าจองสนาม (/) พร้อมส่งรหัสโค้ชไปด้วย
              // เก็บลง sessionStorage ด้วย เพราะหน้า / เป็น full redirect ตอน login LINE (query ถูกตัด)
              try {
                sessionStorage.setItem('coach_id', coach.id)
              } catch {
                // sessionStorage ถูกปิด — ยังส่งทาง query ได้
              }
              router.push(`/?coach=${encodeURIComponent(coach.id)}`)
            }}
            disabled={!coach}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <CalendarDays className="h-4 w-4" />
            ถัดไป — เลือกวันและเวลา
          </Button>
        </div>
      )}

      {step === 2 && coach && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{coach.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {coach.level} • {thb(coach.pricePerHour)}/ชม.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
              เปลี่ยนโค้ช
            </Button>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-emerald-600" />
              เลือกสนามที่ใช้สอน
            </p>
            <div className="grid grid-cols-3 gap-2">
              {courts.map((c) => {
                const active = c.id === courtId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCourt(c.id)}
                    aria-pressed={active}
                    className={
                      'rounded-xl border px-2 py-2 text-xs transition-colors ' +
                      (active
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'bg-white hover:border-emerald-300')
                    }
                  >
                    <span className="block font-medium">{c.name}</span>
                    <span className={'block text-[10px] ' + (active ? 'text-white/80' : 'text-muted-foreground')}>
                      {thb(c.pricePerHour)}/ชม.
                    </span>
                  </button>
                )
              })}
            </div>
            {courts.length === 0 && (
              <p className="text-[11px] text-muted-foreground">กำลังโหลดรายการสนาม…</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              เลือกวัน
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.map((d) => {
                const value = format(d, 'yyyy-MM-dd')
                const active = value === date
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pickDay(value)}
                    aria-pressed={active}
                    className={
                      'flex flex-col items-center rounded-xl border py-2 text-xs transition-colors ' +
                      (active ? 'border-emerald-500 bg-emerald-500 text-white' : 'bg-white hover:border-emerald-300')
                    }
                  >
                    <span className="font-medium">{THAI_DAYS_SHORT[d.getDay()]}</span>
                    <span className={active ? 'text-white/80' : 'text-muted-foreground'}>{thaiDate(value)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <Clock className="h-4 w-4 text-emerald-600" />
              เลือกเวลา (ช่วงละ 1 ชั่วโมง)
              {slotsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {COACH_SLOT_TIMES.map((t) => {
                const passed = isSlotPassed(date, t, now)
                const courtBusy = !!court && busyCourtSlots.has(`${court.id}|${t}`)
                const coachBusy = !!coach && busyCoachSlots.has(`${coach.id}|${t}`)
                const blocked = passed || courtBusy || coachBusy
                const blockLabel = passed
                  ? 'ปิดรับจองแล้ว'
                  : courtBusy
                    ? 'สนามไม่ว่าง'
                    : coachBusy
                      ? 'โค้ชติดคิว'
                      : ''
                const active = times.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={blocked}
                    title={blockLabel}
                    onClick={() => toggleTime(t)}
                    aria-pressed={active}
                    className={
                      'rounded-xl border py-2 text-xs transition-colors ' +
                      (blocked
                        ? 'cursor-not-allowed bg-muted/60 text-muted-foreground/60'
                        : active
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'bg-white hover:border-emerald-300')
                    }
                  >
                    <span className="font-medium">{t}</span>
                    <span className={'block text-[10px] ' + (active ? 'text-white/80' : 'text-muted-foreground')}>
                      {blocked ? blockLabel : `–${slotEndTime(t)}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">
                ค่าโค้ช {times.length} ชม. {thb(coachTotal)} + ค่าสนาม {times.length} ชม. {thb(courtTotal)}
              </p>
              <p className="text-lg font-bold text-emerald-700">รวม {thb(total)}</p>
            </div>
            <Button
              onClick={() => setStep(3)}
              disabled={times.length === 0 || !court}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              ถัดไป — สรุป
            </Button>
          </div>
        </div>
      )}

      {step === 3 && coach && court && (
        <div className="space-y-3">
          <div className="space-y-2.5 rounded-2xl border bg-white p-4">
            <p className="font-semibold">สรุปรายการจองโค้ช</p>
            <dl className="space-y-1.5 text-sm">
              <SummaryRow label="โค้ช" value={`${coach.name} (${coach.level})`} />
              <SummaryRow label="สนาม" value={court.name} />
              <SummaryRow label="วัน" value={thaiDate(date)} />
              <SummaryRow label="เวลา" value={thaiTimeRange(times)} />
              <SummaryRow label="จำนวน" value={`${times.length} ชั่วโมง`} />
            </dl>
            <dl className="space-y-1.5 border-t pt-2 text-sm">
              <SummaryRow label={`ค่าสนาม (${times.length} ชม.)`} value={thb(courtTotal)} />
              <SummaryRow
                label={`ค่าโค้ช (${times.length} ชม. × ${thb(coach.pricePerHour)})`}
                value={thb(coachTotal)}
              />
            </dl>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium">ยอดชำระรวม</span>
              <span className="text-xl font-bold text-emerald-700">{thb(total)}</span>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border bg-white p-4">
            <p className="flex items-center gap-1 font-semibold">
              <User className="h-4 w-4 text-emerald-600" />
              ข้อมูลผู้จอง
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="coach-name" className="text-[11px] text-muted-foreground">
                  ชื่อผู้จอง *
                </label>
                <input
                  id="coach-name"
                  value={form.playerName}
                  onChange={(e) => setForm((p) => ({ ...p, playerName: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="coach-phone" className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  เบอร์โทร *
                </label>
                <input
                  id="coach-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.playerPhone}
                  onChange={(e) => setForm((p) => ({ ...p, playerPhone: e.target.value }))}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="coach-email" className="text-[11px] text-muted-foreground">
                  อีเมล (ไม่บังคับ)
                </label>
                <input
                  id="coach-email"
                  type="email"
                  value={form.playerEmail}
                  onChange={(e) => setForm((p) => ({ ...p, playerEmail: e.target.value }))}
                  placeholder="name@example.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="coach-note" className="text-[11px] text-muted-foreground">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input
                  id="coach-note"
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="เช่น ต้องการเน้นฟุตเวิร์ก"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            {(formErrors.playerName || formErrors.playerPhone) && (
              <p className="text-xs text-red-500">{formErrors.playerName || formErrors.playerPhone}</p>
            )}
          </div>

          <div className="space-y-2.5 rounded-2xl border bg-white p-4">
            <p className="flex items-center gap-1 font-semibold">
              <UploadCloud className="h-4 w-4 text-emerald-600" />
              สลิปการชำระเงิน
            </p>
            {slip ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <img src={slip.dataUrl} alt="สลิป" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{slip.name}</p>
                  <p className="text-xs text-emerald-700">พร้อมส่ง ({Math.ceil(slip.size / 1024)}kB)</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveSlip}
                  className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  aria-label="ลบสลิป"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 p-5 transition-colors hover:bg-emerald-50/50"
              >
                <UploadCloud className="h-7 w-7 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">แตะเพื่อเลือกไฟล์สลิป</span>
                <span className="text-[11px] text-muted-foreground">jpg / png — ไม่เกิน 300kB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleSlipChange}
            />
            {slipError && <p className="text-xs text-red-500">{slipError}</p>}
            {formErrors.slip && <p className="text-xs text-red-500">{formErrors.slip}</p>}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4" />
              ย้อนกลับ
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleProceed}
              disabled={times.length === 0 || submitting}
            >
              <QrCode className="h-4 w-4" />
              จ่ายเงิน {thb(total)}
            </Button>
          </div>

          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            แนบสลิปให้ครบก่อนกดจ่ายเงิน — หลังยืนยัน ระบบจะบันทึกการจองจริงและรอเจ้าหน้าที่ตรวจสอบการชำระ
          </p>
        </div>
      )}

      {/* PromptPay Payment Dialog */}
      <Dialog open={qrOpen} onOpenChange={(open) => { if (!open && !submitting) setQrOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              ชำระเงินด้วย PromptPay
            </DialogTitle>
            <DialogDescription>
              สแกน QR Code เพื่อชำระเงินจำนวน{' '}
              <span className="font-semibold text-emerald-700">{thb(total)}</span> (ค่าสนาม + ค่าโค้ช)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-emerald-800">รายละเอียดการจอง</p>
            <p>
              {coach?.name} • {court?.name} • {thaiDate(date)}
            </p>
            <p>
              {thaiTimeRange(times)} ({times.length} ชม.)
            </p>
            <div className="flex justify-between border-t border-emerald-100 pt-1">
              <span>
                ค่าสนาม {thb(courtTotal)} + ค่าโค้ช {thb(coachTotal)}
              </span>
              <span className="font-semibold text-emerald-700">{thb(total)}</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            {qrLoading ? (
              <div className="flex h-56 w-56 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="PromptPay QR" className="h-56 w-56 rounded-xl" />
            ) : (
              <p className="text-xs text-muted-foreground">สร้าง QR ไม่สำเร็จ — ลองใหม่อีกครั้ง</p>
            )}
            {paid && (
              <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {submitting ? 'กำลังบันทึกการจอง…' : 'ชำระเงินเรียบร้อย'}
              </p>
            )}
          </div>

          {submitError && <p className="text-xs text-red-500">{submitError}</p>}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setQrOpen(false)}
              disabled={submitting}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmPaid}
              disabled={submitting || qrLoading || !qrDataUrl}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              ชำระเงินแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}




