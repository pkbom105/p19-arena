'use client'

import { apiUrl } from '@/lib/api'
import { useEffect, useMemo, useState } from 'react'
import { addDays, format, isToday, isTomorrow, startOfToday } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarDays, CalendarIcon, Check, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'
import { getSlotPrice, type PriceRule } from '@/lib/price'
import { isSlotPassed, isSlotStarted } from '@/lib/slot-time'
import { useBookingStore, type Court, type TimeSlot } from '@/store/booking-store'

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
/** ชื่อวันแบบสั้น — ใช้บนจอแค่ (แถบวันที่เป็น 7 คอลัมน์) */
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** เปิดจองล่วงหน้าได้ไม่เกิน 42 วัน */
const MAX_ADVANCE_DAYS = 42
/** แถบวันที่แสดง 14 วัน (7 คอลัมน์ × 2 แถว) — วันที่เกินจากนี้เลือกได้จากปฏิทิน (42 วัน) */
const DISPLAY_DAYS = 14

const COURT_COLORS = [
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
]
const COURT_ICONS = ['1', '2', '3', '4', '5', '6']

/** การจองที่มีอยู่แล้วของวันที่เลือก (จาก /api/bookings?date=) */
interface GridBooking {
  id: string
  status: string
  courtId: string
  timeSlotId: string
}

/** สีของช่องที่มีคนจองแล้ว — ลูกค้าไม่เห็นชื่อคนอื่น */
const OCCUPIED_CELL: Record<string, string> = {
  pending: 'bg-amber-100 border-amber-300 text-amber-900',
  confirmed: 'bg-emerald-100 border-emerald-300 text-emerald-900',
}
const OCCUPIED_LABEL: Record<string, string> = {
  pending: 'รอชำระ',
  confirmed: 'จองแล้ว',
}

const cellKey = (courtId: string, slotId: string) => `${courtId}|${slotId}`

/**
 * เลือกสนาม + เวลา จบในหน้าเดียว — ตาราง "เวลา × สนาม" แบบ POS
 * กดช่องว่างเพื่อเลือกได้หลายช่อง/หลายสนามพร้อมกัน แล้วกด "ถัดไป" เพื่อไปหน้าสรุป
 * กติกาเวลา: ปิดรับจองเมื่อเลย startTime + 20 นาที (เหมือนฝั่ง API — slot-time.ts)
 */
export function StepGrid() {
  const {
    courts, setCourts, selectedDate, setSelectedDate,
    selectedCells, toggleCell, clearCells, addBookingItems,
    priceRules, setPriceRules, bookingItems, setStep,
  } = useBookingStore()

  const [loading, setLoading] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [daySlots, setDaySlots] = useState<TimeSlot[]>([])
  const [dayBookings, setDayBookings] = useState<GridBooking[]>([])
  // เดินเวลาทุก 30 วิ — ช่องที่เลย startTime + 20 นาทีปิดรับจองเองโดยไม่ต้องรีเฟรช
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // สนาม + ช่วงราคา (โหลดครั้งเดียว)
  useEffect(() => {
    let alive = true
    async function fetchBase() {
      try {
        const [courtsRes, rulesRes] = await Promise.all([
          fetch(apiUrl('/api/courts')),
          fetch(apiUrl('/api/pricerules')),
        ])
        const courtsData: Court[] = await courtsRes.json()
        const rulesData: PriceRule[] = await rulesRes.json()
        if (!alive) return
        setCourts(courtsData)
        if (Array.isArray(rulesData)) setPriceRules(rulesData)
      } catch (err) {
        console.error('Failed to fetch courts/price rules', err)
      }
    }
    fetchBase()
    return () => {
      alive = false
    }
  }, [setCourts, setPriceRules])

  // วันเริ่มต้น = วันนี้
  useEffect(() => {
    if (!selectedDate) setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
  }, [selectedDate, setSelectedDate])

  // ช่วงเวลา + การจองของวันที่เลือก
  useEffect(() => {
    if (!selectedDate) return
    let alive = true
    async function fetchDay() {
      setLoading(true)
      try {
        const [slotsRes, bookingsRes] = await Promise.all([
          fetch(apiUrl(`/api/timeslots?date=${selectedDate}`)),
          fetch(apiUrl(`/api/bookings?date=${selectedDate}`)),
        ])
        const slotsData: TimeSlot[] = await slotsRes.json()
        const bookingsData = await bookingsRes.json()
        if (!alive) return
        setDaySlots(Array.isArray(slotsData) ? slotsData : [])
        setDayBookings(Array.isArray(bookingsData) ? bookingsData : [])
      } catch (err) {
        console.error('Failed to fetch slots/bookings', err)
      } finally {
        if (alive) setLoading(false)
      }
    }
    fetchDay()
    return () => {
      alive = false
    }
  }, [selectedDate])

  const dayOfWeek = selectedDate ? new Date(selectedDate + 'T00:00:00').getDay() : 0

  /** ช่องที่มีคนจองแล้ว (ไม่นับการจองที่ยกเลิก) */
  const occupied = useMemo(() => {
    const map = new Map<string, GridBooking>()
    for (const b of dayBookings) {
      if (b.status === 'cancelled') continue
      map.set(cellKey(b.courtId, b.timeSlotId), b)
    }
    return map
  }, [dayBookings])

  /** ช่องที่อยู่ในตะกร้าแล้ว (เลือกไว้ก่อนหน้าในวันเดียวกัน ยังไม่ยืนยัน) */
  const cartKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const item of bookingItems) {
      if (item.date !== selectedDate) continue
      for (const slot of item.timeSlots) keys.add(cellKey(item.court.id, slot.id))
    }
    return keys
  }, [bookingItems, selectedDate])

  const priceOf = (court: Court, slot: TimeSlot) =>
    getSlotPrice(court.pricePerHour, dayOfWeek, slot.startTime, priceRules)

  const total = useMemo(() => {
    let sum = 0
    for (const key of selectedCells) {
      const [courtId, slotId] = key.split('|')
      const court = courts.find((c) => c.id === courtId)
      const slot = daySlots.find((s) => s.id === slotId)
      if (court && slot) sum += priceOf(court, slot)
    }
    return sum
  }, [selectedCells, courts, daySlots, priceRules, dayOfWeek])

  /** กด "ถัดไป" — จัดกลุ่มช่องที่เลือกตามสนาม แล้วเก็บลงตะกร้า */
  const handleNext = () => {
    const byCourt = new Map<string, { court: Court; timeSlots: TimeSlot[] }>()
    for (const key of selectedCells) {
      const [courtId, slotId] = key.split('|')
      const court = courts.find((c) => c.id === courtId)
      const slot = daySlots.find((s) => s.id === slotId)
      if (!court || !slot) continue
      const entry = byCourt.get(courtId) ?? { court, timeSlots: [] }
      entry.timeSlots.push(slot)
      byCourt.set(courtId, entry)
    }
    const items = [...byCourt.values()].map((entry) => ({
      court: entry.court,
      timeSlots: [...entry.timeSlots].sort((a, b) => a.sortOrder - b.sortOrder),
      date: selectedDate,
    }))
    if (items.length === 0) return
    addBookingItems(items)
    setStep(3)
  }

  // ---------- แถบเลือกวันที่ ----------
  const minDate = useMemo(() => startOfToday(), [])
  const maxDate = useMemo(() => addDays(new Date(), MAX_ADVANCE_DAYS), [])
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined
  const dates = Array.from({ length: DISPLAY_DAYS }, (_, i) => {
    const d = addDays(new Date(), i)
    const dow = d.getDay()
    return {
      value: format(d, 'yyyy-MM-dd'),
      day: THAI_DAYS[dow],
      dayShort: THAI_DAYS_SHORT[dow],
      date: d.getDate(),
      month: THAI_MONTHS_SHORT[d.getMonth()],
      isToday: isToday(d),
      isTomorrow: isTomorrow(d),
      isWeekend: dow === 0 || dow === 6,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">จองสนาม — เลือกวัน / สนาม / เวลา</h2>
      </div>

      {/* แถบวันที่: 21 วัน + ปฏิทิน (จองล่วงหน้าได้ 42 วัน) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          เลือกวันที่ แล้วกดช่องว่างในตารางเพื่อจอง
          <span className="ml-2 inline-block rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-md">
            จองล่วงหน้าได้ {MAX_ADVANCE_DAYS} วัน
          </span>
        </p>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <CalendarIcon className="h-4 w-4" />
              {selectedDateObj ? format(selectedDateObj, 'd MMM yy', { locale: th }) : 'เลือกจากปฏิทิน'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={th}
              selected={selectedDateObj}
              onSelect={(d) => {
                if (!d) return
                setSelectedDate(format(d, 'yyyy-MM-dd'))
                setCalendarOpen(false)
              }}
              disabled={[{ before: minDate }, { after: maxDate }]}
              startMonth={minDate}
              endMonth={maxDate}
              defaultMonth={selectedDateObj}
            />
            <div className="border-t px-3 py-2 text-xs text-muted-foreground text-center">
              จองได้ตั้งแต่วันนี้ — {format(maxDate, 'd MMM yy', { locale: th })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {dates.map((d) => (
          <Card
            key={d.value}
            className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] border-2 ${
              selectedDate === d.value
                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                : d.isWeekend
                  ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
                  : 'border-transparent hover:border-emerald-200'
            }`}
            onClick={() => setSelectedDate(d.value)}
          >
            <CardContent className="p-1.5 text-center">
              <div className="truncate text-[12px] font-medium leading-none text-muted-foreground sm:text-[15px]">
                <span className="sm:hidden">{d.isToday ? 'วันนี้' : d.isTomorrow ? 'พรุ่งนี้' : d.dayShort}</span>
                <span className="hidden sm:inline">{d.isToday ? 'วันนี้' : d.isTomorrow ? 'พรุ่งนี้' : d.day}</span>
              </div>
              <div className="mt-0.5 text-base font-bold leading-tight sm:text-lg">{d.date}</div>
              <div className="text-[12px] leading-none text-muted-foreground sm:text-[15px]">{d.month}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------- ตาราง: เวลา × สนาม ---------- */}
      <div className="flex items-center gap-2 pt-1">
        <MapPin className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold">ตารางการจอง</h3>
        <LiveClock />
        {selectedDateObj && (
          <span className="ml-auto whitespace-nowrap rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-1.5 font-sans text-xl font-bold text-white shadow-md shadow-emerald-900/25 ring-1 ring-emerald-700/20">
            {format(selectedDateObj, 'EEEE d MMM yyy', { locale: th })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : courts.length === 0 || daySlots.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {courts.length === 0
            ? 'ยังไม่มีสนามให้จอง'
            : `ไม่มีช่วงเวลาสำหรับวัน${THAI_DAYS[dayOfWeek]} — เลือกวันอื่นด้านบน`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full border-collapse font-sans text-sm font-normal">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-16 border-b border-r bg-muted/60 px-2 py-2 text-left font-normal text-muted-foreground">
                  เวลา
                </th>
                {courts.map((court, idx) => (
                  <th key={court.id} className="min-w-[7.5rem] border-b border-l px-2 py-2 text-center font-normal">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`${COURT_COLORS[idx % COURT_COLORS.length]} text-white rounded-md w-5 h-5 flex items-center justify-center text-sm`}
                      >
                        {COURT_ICONS[idx % COURT_ICONS.length]}
                      </span>
                      <span>{court.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ฿{court.pricePerHour.toLocaleString()}/ชม.
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daySlots.map((slot) => (
                <GridRow
                  key={slot.id}
                  slot={slot}
                  courts={courts}
                  occupied={occupied}
                  cartKeys={cartKeys}
                  selectedCells={selectedCells}
                  onToggle={toggleCell}
                  selectedDate={selectedDate}
                  now={now}
                  priceOf={priceOf}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* คำอธิบายสี */}
      {!loading && courts.length > 0 && daySlots.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-emerald-200 bg-emerald-50/40" /> ว่าง
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-emerald-600 bg-emerald-500" /> เลือกอยู่
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-dashed border-emerald-400 bg-emerald-50/60" /> ในตะกร้า
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-amber-300 bg-amber-100" /> จองแล้ว
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-muted bg-muted/30" /> ปิดรับจอง
          </span>
        </div>
      )}

      {/* แถบสรุปด้านล่าง — กดถัดไปเพื่อไปหน้าสรุปรายการ */}
      {selectedCells.length > 0 && (
        <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm border-t pt-3 pb-1 -mx-4 px-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              เลือกแล้ว <span className="font-semibold text-emerald-600">{selectedCells.length}</span> ช่วงเวลา
            </span>
            <span className="text-sm font-semibold text-emerald-700">฿{total.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearCells}>
              ล้างทั้งหมด
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleNext}>
              ถัดไป
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface GridRowProps {
  slot: TimeSlot
  courts: Court[]
  occupied: Map<string, GridBooking>
  cartKeys: Set<string>
  selectedCells: string[]
  onToggle: (key: string) => void
  selectedDate: string
  now: Date
  priceOf: (court: Court, slot: TimeSlot) => number
}

/** 1 แถวของตาราง = ช่วงเวลา 1 ช่วง × ทุกสนาม */
function GridRow({ slot, courts, occupied, cartKeys, selectedCells, onToggle, selectedDate, now, priceOf }: GridRowProps) {
  return (
    <tr className="border-b last:border-b-0">
      <th className="sticky left-0 z-10 border-r bg-white px-2 py-1.5 text-left align-middle font-normal">
        <div className="leading-tight">{slot.startTime}</div>
        <div className="text-sm leading-tight text-muted-foreground">{slot.endTime}</div>
      </th>
      {courts.map((court) => {
        const key = cellKey(court.id, slot.id)
        const booked = occupied.get(key)
        // มีคนจองแล้ว (ลูกค้าไม่เห็นชื่อคนอื่น)
        if (booked) {
          return (
            <td key={court.id} className="border-l p-1">
              <div
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg border ${
                  OCCUPIED_CELL[booked.status] ?? 'bg-muted border-border text-muted-foreground'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>
                  {OCCUPIED_LABEL[booked.status] ?? 'จองแล้ว'}
                </span>
              </div>
            </td>
          )
        }
        // ปิดรับจองแล้ว (เลย startTime + 20 นาที)
        if (isSlotPassed(selectedDate, slot.startTime, now)) {
          return (
            <td key={court.id} className="border-l p-1">
              <div className="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-muted bg-muted/30 text-muted-foreground/60">
                <span className="line-through">฿{priceOf(court, slot).toLocaleString()}</span>
                <span>ปิดรับจอง</span>
              </div>
            </td>
          )
        }
        const selected = selectedCells.includes(key)
        // อยู่ในตะกร้าแล้ว (เลือกไว้ก่อนหน้านี้ ยังไม่ยืนยัน)
        if (!selected && cartKeys.has(key)) {
          return (
            <td key={court.id} className="border-l p-1">
              <div className="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50/60 text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                <span>ในตะกร้า</span>
              </div>
            </td>
          )
        }
        // เริ่มช่วงเวลาแล้วแต่ยังอยู่ในเวลาผ่อนผัน (20 นาที) → ยังจองได้ (สีส้ม)
        const started = isSlotStarted(selectedDate, slot.startTime, now)
        return (
          <td key={court.id} className="border-l p-1">
            <button
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={selected}
              title={`จอง ${court.name} ${slot.startTime}-${slot.endTime}`}
              className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors ${
                selected
                  ? 'border-emerald-600 bg-emerald-500 text-white shadow-sm'
                  : started
                    ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                    : 'border-emerald-200 bg-emerald-50/40 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100'
              }`}
            >
              {selected ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>เลือกอยู่</span>
                </>
              ) : (
                <>
                  <span>฿{priceOf(court, slot).toLocaleString()}</span>
                  <span className="opacity-80">เลือก</span>
                </>
              )}
            </button>
          </td>
        )
      })}
    </tr>
  )
}

/** นาฬิกาเรียลไทม์ — เดินทุกวินาที แยก state/interval จากตาราง (tick 30 วิ) เพื่อไม่ให้ทั้งตาราง re-render ทุกวินาที */
function LiveClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="mx-auto flex items-center gap-4 whitespace-nowrap rounded-full border border-emerald-300 bg-white px-6 py-1.5 font-sans text-lg font-light text-emerald-700 tabular-nums shadow-sm shadow-emerald-900/10">
      {/* <Clock className="h-4 w-4 text-emerald-600" /> */}
      {format(time, 'HH:mm:ss')}
    </span>
  )
}
