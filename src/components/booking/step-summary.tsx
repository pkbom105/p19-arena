'use client'

import { apiUrl } from '@/lib/api'
import { useEffect, useState, useRef, useMemo } from 'react'
import { User, Phone, Plus, Trash2, CalendarDays, MapPin, Clock, ClipboardList, Wrench, Minus, QrCode, Loader2, CheckCircle2, Download, Dumbbell, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useBookingStore } from '@/store/booking-store'
import type { BookingItem, RentalItem, BookingData, CoachSelection } from '@/store/booking-store'
import { COACH_PACKAGES } from '@/components/activity/coaches'
import { getItemPriceWithRules, type PriceRule } from '@/lib/price'
import { generatePromptPayQR } from '@/components/qrcode'
import { toPng } from 'html-to-image'

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = THAI_DAYS[d.getDay()]
  return `${dayName} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

function formatPrice(amount: number) {
  return amount.toLocaleString()
}

function getItemPrice(item: BookingItem, rules: PriceRule[]) {
  return getItemPriceWithRules(item, rules)
}

function getItemHours(item: BookingItem) {
  return item.timeSlots.reduce((s, ts) => {
    const start = parseInt(ts.startTime.split(':')[0]) + parseInt(ts.startTime.split(':')[1]) / 60
    const end = parseInt(ts.endTime.split(':')[0]) + parseInt(ts.endTime.split(':')[1]) / 60
    return s + (end - start)
  }, 0)
}

function BookingItemCard({ item, onRemove, rules }: { item: BookingItem; onRemove: () => void; rules: PriceRule[] }) {
  const sortedSlots = [...item.timeSlots].sort((a, b) => a.sortOrder - b.sortOrder)
  const itemPrice = getItemPrice(item, rules)
  const itemHours = getItemHours(item)

  return (
    <Card className="border-emerald-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{formatDate(item.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{item.court.name}</span>
              <span className="text-[11px] text-muted-foreground">(฿{formatPrice(item.court.pricePerHour)}/ชม.)</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {sortedSlots.map((s) => (
                  <span
                    key={s.id}
                    className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded"
                  >
                    {s.startTime} - {s.endTime}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="ลบรายการ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
              ฿{formatPrice(itemPrice)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {itemHours} ชม.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** การ์ด "เพิ่มโค้ช (ค่าสนามฝึก)" — เพิ่ม/ยกเลิกโค้ชได้จากขั้นสรุป แล้วบวกเข้าราคารวมทั้งหมด */
/** แถวชั่วโมงที่จอง — ใช้ติ๊กว่าชั่วโมงไหนให้โค้ชดูแล */
interface CoachSlotOption {
  key: string
  label: string
}

/** เพดานจำนวนชั่วโมงโค้ชที่เลือกได้ (กันค่าที่ไม่สมเหตุสมผล) */
const COACH_MAX_HOURS = 8

function CoachAddCard({
  coach,
  bookedHours,
  coachHours,
  slots,
  tickedKeys,
  onPick,
  onClear,
  onHoursChange,
  onToggleSlot,
}: {
  coach: CoachSelection | null
  bookedHours: number
  coachHours: number
  slots: CoachSlotOption[]
  tickedKeys: string[]
  onPick: (next: CoachSelection) => void
  onClear: () => void
  onHoursChange: (next: number) => void
  onToggleSlot: (key: string) => void
}) {
  const ticked = tickedKeys.length
  return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-emerald-600" />
          เพิ่มโค้ช (ค่าสนามฝึก)
          {coach && <Badge className="bg-emerald-500 text-white text-[10px]">เพิ่มแล้ว</Badge>}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground pt-1">
          ค่าโค้ช = ราคาต่อชั่วโมง × ชั่วโมงที่เลือกให้โค้ชดูแล — บวกเข้าราคารวมทั้งหมด
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2.5">
        {COACH_PACKAGES.map((pkg) => {
          const active = coach?.id === pkg.id
          return (
            <div
              key={pkg.id}
              className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
                active ? 'border-emerald-400 bg-emerald-100/60' : 'border-emerald-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-full bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {pkg.initial}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{pkg.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {pkg.level} • ฿{formatPrice(pkg.pricePerHour)}/ชม.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {active ? (
                  <>
                    <span className="text-xs font-semibold text-emerald-700">
                      ฿{formatPrice(pkg.pricePerHour * coachHours)}
                    </span>
                    <button
                      type="button"
                      aria-label={`ยกเลิกโค้ช ${pkg.name}`}
                      className="w-7 h-7 rounded-lg border border-emerald-300 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                      onClick={onClear}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={`เพิ่มโค้ช ${pkg.name}`}
                    className="w-7 h-7 rounded-lg border border-emerald-300 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                    onClick={() => onPick({ id: pkg.id, name: pkg.name, pricePerHour: pkg.pricePerHour })}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {coach ? (
          <div className="rounded-lg border border-emerald-200 bg-white p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-emerald-800 min-w-0">
                ชั่วโมงโค้ช{' '}
                <span data-coach-hours={coachHours} className="font-semibold">
                  {coachHours}
                </span>{' '}
                ชม.
                <span
                  data-coach-ticked={ticked}
                  className="ml-1 text-[11px] font-normal text-muted-foreground"
                >
                  (ติ๊กแล้ว {ticked}/{coachHours} ชม.)
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="ลดจำนวนชั่วโมงโค้ช"
                  className="w-7 h-7 rounded-lg border border-emerald-300 flex items-center justify-center hover:bg-emerald-100 transition-colors disabled:opacity-30"
                  onClick={() => onHoursChange(coachHours - 1)}
                  disabled={coachHours <= 1}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="เพิ่มจำนวนชั่วโมงโค้ช"
                  className="w-7 h-7 rounded-lg border border-emerald-300 flex items-center justify-center hover:bg-emerald-100 transition-colors disabled:opacity-30"
                  onClick={() => onHoursChange(coachHours + 1)}
                  disabled={coachHours >= COACH_MAX_HOURS}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              ติ๊กชั่วโมงที่จองไว้ ({bookedHours} ชม.) ที่จะให้โค้ชดูแล
            </div>

            <div className="space-y-1.5">
              {slots.map((s) => {
                const checked = tickedKeys.includes(s.key)
                return (
                  <label
                    key={s.key}
                    className={`flex items-start gap-2 rounded-md border px-2 py-1.5 cursor-pointer ${
                      checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      data-coach-slot={s.key}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                      checked={checked}
                      disabled={!checked && ticked >= coachHours}
                      onChange={() => onToggleSlot(s.key)}
                    />
                    <span className="text-[11px] leading-snug break-words min-w-0">{s.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            กด + เพื่อเพิ่มโค้ช แล้วเลือกชั่วโมงที่ให้โค้ชดูแล (เวลาที่จอง {bookedHours} ชม.)
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function StepSummary() {
  const { bookingItems, removeBookingItem, setStep, goToStep, rentalSelections, setRentalSelections, updateRentalQuantity, priceRules, setPriceRules, bookingForm, setBookingForm, lineUser, coach, setCoach, coachHours, setCoachHours, coachTickedKeys, setCoachTickedKeys } = useBookingStore()
  const [equipment, setEquipment] = useState<RentalItem[]>([])
  const [equipLoading, setEquipLoading] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const qrReceiptRef = useRef<HTMLDivElement>(null)
  const [qrDownloading, setQrDownloading] = useState(false)
  const [bookerErrors, setBookerErrors] = useState<Record<string, string>>({})
  const prefillDone = useRef(false)
  // ติ๊กบ็อกซ์เวลาโค้ช: จำนวนชั่วโมงโค้ชที่ผู้ใช้กำหนด + ชั่วโมงที่จองซึ่งเลือกให้โค้ชดูแล
  // — เก็บใน store (ไม่ใช่ state ของหน้านี้) เพื่อให้ขั้นยืนยันการจองส่ง "ชั่วโมงที่ติ๊ก" ไปคิดเงินได้ตรงกันทั้งใบ

  // Auto-fill ข้อมูลผู้จอง (ชื่อ/เบอร์) จาก LINE ID เดิม / ข้อมูลเก่าที่เคยจอง
  useEffect(() => {
    if (prefillDone.current) return
    const u = lineUser
    if (!u || !u.id) return
    const patch: Partial<BookingData> = {}
    if (!bookingForm.playerName) {
      const savedName = u.name || u.lineDisplayName || ''
      if (savedName) patch.playerName = savedName
    }
    if (!bookingForm.playerPhone && u.phone) {
      patch.playerPhone = u.phone
    }
    if (Object.keys(patch).length > 0) setBookingForm(patch)
    prefillDone.current = true
  }, [lineUser, bookingForm.playerName, bookingForm.playerPhone, setBookingForm])

  useEffect(() => {
    async function fetchEquipment() {
      try {
        const res = await fetch(apiUrl('/api/equipment'))
        const data = await res.json()
        // Initialize rental selections from available equipment
        const items: RentalItem[] = data.map((e: { id: string; name: string; nameEn: string | null; pricePerUnit: number }) => ({
          id: e.id,
          name: e.name,
          nameEn: e.nameEn,
          pricePerUnit: e.pricePerUnit,
          quantity: 0,
        }))
        setEquipment(items)
        // Only set initial selections if not already set
        setRentalSelections(items)
      } catch (err) {
        console.error('Failed to fetch equipment', err)
      } finally {
        setEquipLoading(false)
      }
    }
    fetchEquipment()
  }, [setRentalSelections])

  // Ensure price rules are loaded for accurate pricing display.
  useEffect(() => {
    fetch(apiUrl('/api/pricerules'))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPriceRules(data)
      })
      .catch(() => {})
  }, [setPriceRules])

  const totalSlots = bookingItems.reduce((sum, item) => sum + item.timeSlots.length, 0)
  const totalHours = bookingItems.reduce((sum, item) => sum + getItemHours(item), 0)
  const courtPrice = bookingItems.reduce((sum, item) => sum + getItemPrice(item, priceRules), 0)
  const rentalPrice = rentalSelections.reduce((sum, r) => sum + r.pricePerUnit * r.quantity, 0)

  /** ชั่วโมงที่จอง (ปัดลงเป็นชั่วโมงเต็ม) — ใช้เทียบกับจำนวนชั่วโมงโค้ช */
  const bookedHours = Math.max(1, Math.floor(totalHours))
  /** ตัวเลือกติ๊ก "ชั่วโมงที่จอง" — 1 ช่อง ต่อ 1 ช่วงเวลาที่จอง */
  const coachSlotOptions: CoachSlotOption[] = useMemo(
    () =>
      bookingItems.flatMap((item) =>
        [...item.timeSlots]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((ts) => ({
            key: `${item.id}|${ts.id}`,
            label: `${formatDate(item.date)} · ${item.court.name} · ${ts.startTime} - ${ts.endTime}`,
          }))
      ),
    [bookingItems]
  )

  // ซิงก์จำนวนชั่วโมงโค้ช + ติ๊กบ็อกซ์กับรายการที่จอง
  // เงื่อนไข 1: เวลาจองเท่ากับเวลาโค้ช → ติ๊กครบทุกช่องให้อัตโนมัติ (ready to pay)
  useEffect(() => {
    const keys = coachSlotOptions.map((s) => s.key)
    if (!coach) {
      setCoachHours((h) => (h === 0 ? h : 0))
      setCoachTickedKeys((prev) => (prev.length === 0 ? prev : []))
      return
    }
    setCoachHours((h) => (h > 0 ? h : bookedHours))
    setCoachTickedKeys((prev) => {
      // เท่ากับเวลาที่จอง → ติ๊กครบให้เอง ; ไม่เท่า (เงื่อนไข 2/3) → คงติ๊กเดิมไว้ แค่ตัดช่องที่ถูกลบ
      const next = coachHours === bookedHours ? keys : prev.filter((k) => keys.includes(k))
      const same = next.length === prev.length && next.every((k, i) => k === prev[i])
      return same ? prev : next
    })
  }, [coach, coachHours, bookedHours, coachSlotOptions])

  const coachTicked = coachTickedKeys.length
  /** เงื่อนไข 3: เวลาจองน้อยกว่าเวลาโค้ช */
  const coachOverBooked = !!coach && coachHours > bookedHours
  /** เงื่อนไข 1/2: จ่ายเงินได้เมื่อติ๊กเท่ากับจำนวนชั่วโมงโค้ช และเวลาโค้ชไม่เกินเวลาที่จอง */
  const coachReady = !coach || (coachTicked === coachHours && !coachOverBooked)
  /** ข้อความบอกเหตุที่ยังกดจ่ายเงินไม่ได้ (เงื่อนไข 2/3) */
  const coachHint =
    !coach || coachReady
      ? ''
      : coachOverBooked
        ? `ชั่วโมงโค้ช ${coachHours} ชม. มากกว่าเวลาที่จอง ${bookedHours} ชม. — กด "จองเพิ่ม" เพื่อเพิ่มเวลาจอง หรือลดชั่วโมงโค้ชให้เท่ากับเวลาที่จอง`
        : coachTicked < coachHours
          ? `เลือกชั่วโมงที่ให้โค้ชดูแลอีก ${coachHours - coachTicked} ชม. (ติ๊กแล้ว ${coachTicked}/${coachHours} ชม.) จึงจะจ่ายเงินได้`
          : `ติ๊กเกินจำนวนชั่วโมงโค้ช ${coachTicked - coachHours} ชม. — ยกเลิกติ๊ก หรือเพิ่มชั่วโมงโค้ช`

  // ค่าโค้ช = ราคาต่อชั่วโมง × จำนวนชั่วโมงที่เลือกให้โค้ชดูแล (บวกเข้าราคารวมทั้งหมด)
  const coachFee = coach ? coach.pricePerHour * coachHours : 0
  const totalPrice = courtPrice + rentalPrice + coachFee

  const handleAddMore = () => {
    // กลับไปกริด "สนาม+เวลา" (หน้าเดียว) โดยคงวันที่ที่เลือกไว้ เพื่อจองสนาม/ช่วงเวลาเพิ่ม
    goToStep(2)
  }

  /** เพิ่มโค้ชจากขั้นสรุป — เก็บลง store + sessionStorage.coach_id + ตั้งชั่วโมงโค้ชเท่าที่จอง (ติ๊กครบ) */
  const handlePickCoach = (next: CoachSelection) => {
    try {
      sessionStorage.setItem('coach_id', next.id)
    } catch {
      // เข้าถึง sessionStorage ไม่ได้ — ข้ามไป
    }
    setCoach(next)
    setCoachHours(bookedHours)
    setCoachTickedKeys(coachSlotOptions.map((s) => s.key))
  }

  /** ยกเลิกโค้ช — ล้างทั้ง sessionStorage และ store เพื่อไม่ให้คิดเงินรวม (เหมือน step-grid) */
  const handleClearCoach = () => {
    try {
      sessionStorage.removeItem('coach_id')
    } catch {
      // เข้าถึง sessionStorage ไม่ได้ — ข้ามไป
    }
    setCoach(null)
    setCoachHours(0)
    setCoachTickedKeys([])
  }

  /** ติ๊ก/ยกติ๊กชั่วโมงที่ให้โค้ชดูแล — ติ๊กได้ไม่เกินจำนวนชั่วโมงโค้ช */
  const handleToggleCoachSlot = (key: string) => {
    setCoachTickedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= coachHours) return prev
      return [...prev, key]
    })
  }

  /** ปรับจำนวนชั่วโมงโค้ช (1 — COACH_MAX_HOURS) */
  const handleCoachHoursChange = (next: number) => {
    setCoachHours(Math.min(COACH_MAX_HOURS, Math.max(1, next)))
  }

  const validateBooker = () => {
    const errs: Record<string, string> = {}
    if (!bookingForm.playerName.trim()) errs.playerName = 'กรุณากรอกชื่อผู้จอง'
    if (!bookingForm.playerPhone.trim()) {
      errs.playerPhone = 'กรุณากรอกเบอร์โทร'
    } else if (!/^\d{9,10}$/.test(bookingForm.playerPhone.replace(/[-\s]/g, ''))) {
      errs.playerPhone = 'เบอร์โทรไม่ถูกต้อง (10 หลัก)'
    }
    setBookerErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleProceed = async () => {
    // ใส่ชื่อผู้จอง + เบอร์โทร ให้ครบ ก่อนที่จะจ่ายเงินได้
    if (!validateBooker()) return
    // ติ๊กชั่วโมงโค้ชไม่ครบตามเงื่อนไข → ห้ามจ่ายเงิน
    if (!coachReady) return
    setQrOpen(true)
    setPaid(false)
    setQrLoading(true)
    setQrDataUrl(null)
    try {
      const url = await generatePromptPayQR(totalPrice)
      setQrDataUrl(url)
    } catch (err) {
      console.error('Failed to generate QR', err)
    } finally {
      setQrLoading(false)
    }
  }

  const handleCloseQr = () => {
    setQrOpen(false)
  }

  const handleDownloadQr = async () => {
    if (!qrDataUrl || !qrReceiptRef.current) return
    setQrDownloading(true)
    try {
      const dataUrl = await toPng(qrReceiptRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `promptpay-${totalPrice}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to download QR receipt', err)
    } finally {
      setQrDownloading(false)
    }
  }

  if (bookingItems.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">สรุปรายการจอง</h2>
        </div>

        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <CalendarDays className="h-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground">ยังไม่มีรายการจอง</p>
            <p className="text-sm text-muted-foreground mt-1">เลือกวัน เวลา และสนามที่ต้องการจอง</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => goToStep(2)}>
            <Plus className="h-4 w-4 mr-2" />
            เลือกวันที่จอง
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">สรุปรายการจอง</h2>
        <Badge className="bg-emerald-500 text-white ml-auto">
          {totalSlots} ช่วงเวลา
        </Badge>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{bookingItems.length}</div>
            <div className="text-[11px] text-emerald-600">รายการ</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{totalHours}</div>
            <div className="text-[11px] text-emerald-600">ชั่วโมง</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-700">฿{formatPrice(courtPrice)}</div>
            <div className="text-[11px] text-emerald-600">ราคาสนาม</div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Booking items list */}
      <div className="space-y-3">
        {bookingItems.map((item, index) => (
          <div key={item.id} className="relative">
            {index > 0 && (
              <div className="absolute -top-2 left-6 right-6 h-px border-t border-dashed border-emerald-200" />
            )}
            <BookingItemCard item={item} onRemove={() => removeBookingItem(item.id)} rules={priceRules} />
          </div>
        ))}
      </div>

      {/* โค้ช (ค่าสนามฝึก) — เพิ่ม/ยกเลิกได้จากขั้นนี้ แล้วบวกเข้าราคารวมทั้งหมดทันที */}
      <CoachAddCard
        coach={coach}
        bookedHours={bookedHours}
        coachHours={coachHours}
        slots={coachSlotOptions}
        tickedKeys={coachTickedKeys}
        onPick={handlePickCoach}
        onClear={handleClearCoach}
        onHoursChange={handleCoachHoursChange}
        onToggleSlot={handleToggleCoachSlot}
      />

      {/* Rental Equipment Section */}
      {rentalSelections.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              เช่าอุปกรณ์เพิ่มเติม
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {rentalSelections.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground">฿{formatPrice(item.pricePerUnit)}/ชิ้น</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-amber-300 flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-30"
                    onClick={() => updateRentalQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-amber-300 flex items-center justify-center hover:bg-amber-100 transition-colors"
                    onClick={() => updateRentalQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {item.quantity > 0 && (
                    <span className="text-xs font-semibold text-amber-700 w-16 text-right">
                      ฿{formatPrice(item.pricePerUnit * item.quantity)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Total price */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">ค่าสนาม</span>
          <span className="font-medium">฿{formatPrice(courtPrice)}</span>
        </div>
        {rentalPrice > 0 && (
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="text-muted-foreground">ค่าเช่าอุปกรณ์</span>
            <span className="font-medium">฿{formatPrice(rentalPrice)}</span>
          </div>
        )}
        {coachFee > 0 && (
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="text-muted-foreground">
              ค่าสนามฝึก ({coach?.name} × {coachHours} ชม.)
            </span>
            <span className="font-medium">฿{formatPrice(coachFee)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-1 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
          <span className="text-sm font-medium text-emerald-800">ราคารวมทั้งหมด</span>
          <span className="text-xl font-bold text-emerald-700">฿{formatPrice(totalPrice)}</span>
        </div>
      </div>

      {/* ข้อมูลผู้จอง — ต้องกรอกให้ครบก่อนจ่ายเงิน */}
      <Card className="border-emerald-200">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" />
            ข้อมูลผู้จอง
            <Badge className="bg-emerald-500 text-white text-[10px]">กรอกให้ครบก่อนจ่ายเงิน</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="summary-playerName" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="h-3.5 w-3.5" /> ชื่อผู้จอง <span className="text-red-500">*</span>
            </Label>
            <Input
              id="summary-playerName"
              placeholder="กรอกชื่อผู้จอง"
              value={bookingForm.playerName}
              onChange={(e) => {
                setBookingForm({ playerName: e.target.value })
                if (bookerErrors.playerName) setBookerErrors((p) => ({ ...p, playerName: '' }))
              }}
              className={bookerErrors.playerName ? 'border-red-400' : ''}
            />
            {bookerErrors.playerName && <p className="text-xs text-red-500">{bookerErrors.playerName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary-playerPhone" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> เบอร์โทร <span className="text-red-500">*</span>
            </Label>
            <Input
              id="summary-playerPhone"
              type="tel"
              inputMode="tel"
              placeholder="0XX-XXX-XXXX"
              value={bookingForm.playerPhone}
              onChange={(e) => {
                setBookingForm({ playerPhone: e.target.value })
                if (bookerErrors.playerPhone) setBookerErrors((p) => ({ ...p, playerPhone: '' }))
              }}
              className={bookerErrors.playerPhone ? 'border-red-400' : ''}
            />
            {bookerErrors.playerPhone && <p className="text-xs text-red-500">{bookerErrors.playerPhone}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm border-t pt-3 pb-1 -mx-4 px-4 mt-4 space-y-2">
        <Button
          variant="outline"
          className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={handleAddMore}
        >
          <Plus className="h-4 w-4 mr-2" />
          จองเพิ่ม — เลือกสนามอีกครั้ง
        </Button>
        {coachHint && (
          <p
            data-coach-hint
            className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug"
          >
            {coachHint}
          </p>
        )}
        <Button
          data-pay-button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          disabled={!coachReady}
          onClick={handleProceed}
        >
          <QrCode className="h-4 w-4 mr-2" />
          จ่ายเงิน
        </Button>
      </div>

      {/* PromptPay Payment Dialog */}
      <Dialog open={qrOpen} onOpenChange={(open) => { if (!open) handleCloseQr() }}>
        <DialogContent className="sm:max-w-md">
          {paid ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  ชำระเงินสำเร็จ
                </DialogTitle>
              </DialogHeader>
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">ขอบคุณที่ชำระเงินเรียบร้อย</p>
                <div className="text-lg font-bold text-emerald-700">฿{formatPrice(totalPrice)}</div>
              </div>
              <DialogFooter>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => { setQrOpen(false); setStep(4) }}>
                  ดำเนินการต่อ
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-emerald-600" />
                  ชำระเงินด้วย PromptPay
                </DialogTitle>
                <DialogDescription>
                  สแกน QR Code เพื่อชำระเงินจำนวน <span className="font-semibold text-emerald-700">฿{formatPrice(totalPrice)}</span>
                </DialogDescription>
              </DialogHeader>

              {/* รายละเอียดการจอง (label) */}
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" />
                  รายละเอียดการจอง
                </div>
                {bookingItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่มีรายการจอง</p>
                ) : (
                  bookingItems.map((item) => (
                    <div key={item.id} className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0 text-emerald-600" />
                        {formatDate(item.date)} — {item.court.name}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Clock className="h-3 w-3 shrink-0 text-emerald-600" />
                        {[...item.timeSlots]
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((s) => `${s.startTime}-${s.endTime}`)
                          .join(', ')}{' '}
                        น. ({item.timeSlots.length} ชม.)
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-1 border-t border-emerald-100 flex justify-between text-xs">
                  <span className="text-muted-foreground">รวมทั้งสิ้น</span>
                  <span className="font-semibold text-emerald-700">฿{formatPrice(totalPrice)}</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-56 h-56 bg-white border rounded-xl flex items-center justify-center">
                  {qrLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  ) : qrDataUrl ? (
                    <img src={qrDataUrl} alt="PromptPay QR" className="w-full h-full rounded-xl" />
                  ) : (
                    <p className="text-sm text-muted-foreground px-4 text-center">ไม่สามารถสร้าง QR ได้</p>
                  )}
                </div>
                {qrDataUrl && !qrLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={handleDownloadQr}
                    disabled={qrDownloading}
                  >
                    {qrDownloading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    ดาวน์โหลด QR
                  </Button>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCloseQr}>
                  ยกเลิก
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPaid(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  ชำระเงินแล้ว
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* พร้อมดาวน์โหลด: แคปภาพใบเสร็จ (QR + รายละเอียดการจอง) ไว้ออฟสกรีน */}
      {qrDataUrl && (
        <div className="fixed left-[-9999px] top-0 pointer-events-none" aria-hidden>
          <div ref={qrReceiptRef} className="w-[320px] bg-white p-5 text-slate-800 font-sans">
            {/* หัวใบเสร็จ */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Dumbbell className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold">P19 Pickleball Arena</div>
                <div className="text-[10px] text-slate-500">ชำระเงินด้วย PromptPay</div>
              </div>
            </div>

            {/* รายละเอียดการจอง */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-1.5 text-left">
              <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                รายละเอียดการจอง
              </div>
              {bookingItems.map((item) => (
                <div key={item.id} className="text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 shrink-0 text-emerald-600" />
                    {formatDate(item.date)} — {item.court.name}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Clock className="h-3 w-3 shrink-0 text-emerald-600" />
                    {[...item.timeSlots]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((s) => `${s.startTime}-${s.endTime}`)
                      .join(', ')}{' '}
                    น. ({item.timeSlots.length} ชม.)
                  </div>
                </div>
              ))}
              <div className="pt-1 border-t border-emerald-100 flex justify-between text-xs">
                <span className="text-slate-500">รวมทั้งสิ้น</span>
                <span className="font-semibold text-emerald-700">฿{formatPrice(totalPrice)}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="mt-3 flex flex-col items-center">
              <div className="w-44 h-44 bg-white border rounded-lg p-1">
                <img src={qrDataUrl} alt="PromptPay QR" className="w-full h-full" />
              </div>
              <div className="mt-2 text-[11px] text-slate-600 font-medium">
                สแกน QR Code เพื่อชำระเงิน ฿{formatPrice(totalPrice)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
