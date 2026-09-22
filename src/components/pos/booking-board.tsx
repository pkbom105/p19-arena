'use client'

import { useEffect, useState } from 'react'
import { addDays, format, subDays } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getSlotPrice, type PriceRule } from '@/lib/price'
import { SLOT_GRACE_MINUTES, isSlotPassed, isSlotStarted, slotCloseTime } from '@/lib/slot-time'
import { THAI_DAYS, THAI_MONTHS, formatThaiDate, statusMeta } from './helpers'
import type { BookingRow, Court, TimeSlotItem } from './types'

interface BookingBoardProps {
  date: string
  onDateChange: (date: string) => void
  todayStr: string
  courts: Court[]
  daySlots: TimeSlotItem[]
  occupied: Map<string, BookingRow>
  priceRules: PriceRule[]
  dayOfWeek: number
  onBookSlot: (preset: { courtId: string; timeSlotId: string; bookingDate: string }) => void
  onNewBooking: () => void
  onEditBooking: (booking: BookingRow) => void
}

/**
 * ตารางจอง — แสดง "สถานะของวันเดียว" (วันนี้เป็นค่าเริ่มต้น)
 * เลือกวันอื่นได้จาก date picker / ปุ่มย้อนหน้า-ถัดไป และกด "จอง" ที่ช่องว่างได้ทันที
 */
export function BookingBoard({
  date, onDateChange, todayStr, courts, daySlots, occupied, priceRules, dayOfWeek,
  onBookSlot, onNewBooking, onEditBooking,
}: BookingBoardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selected = new Date(date + 'T00:00:00')
  const isToday = date === todayStr
  // เดินเวลาเองทุก 30 วิ — ช่องที่เริ่มเกิน 20 นาทีแล้วจะปิดรับจองอัตโนมัติ (ไม่ต้องรีเฟรชหน้า)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  // ทั้งวันปิดรับจองแล้ว (ทุกช่วงเวลาเลย startTime + 20 นาที) → ปิดปุ่มจองใหม่
  const allPassed = daySlots.length > 0 && daySlots.every((s) => isSlotPassed(date, s.startTime, now))

  return (
    <div className="space-y-3">
      {/* Day header — วันที่ที่กำลังดู + date picker + จองใหม่ */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-500 text-white">
              <span className="text-xl font-bold leading-none">{selected.getDate()}</span>
              <span className="mt-0.5 text-[10px]">{THAI_MONTHS[selected.getMonth()]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold leading-tight">{formatThaiDate(date)}</h2>
                {isToday && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">วันนี้</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                สถานะการจองของวัน{THAI_DAYS[dayOfWeek]} — เลือกวันที่เพื่อดู/จองวันอื่น
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="วันก่อนหน้า"
              onClick={() => onDateChange(format(subDays(selected, 1), 'yyyy-MM-dd'))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Date picker */}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                  เลือกวันที่
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selected}
                  defaultMonth={selected}
                  onSelect={(d) => {
                    if (d) {
                      onDateChange(format(d, 'yyyy-MM-dd'))
                      setPickerOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="วันถัดไป"
              onClick={() => onDateChange(format(addDays(selected, 1), 'yyyy-MM-dd'))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => onDateChange(todayStr)}>
                วันนี้
              </Button>
            )}

            {/* จองใหม่ — เปิด dialog แล้วเลือกสนาม/เวลาเอง (ปิดเมื่อทั้งวันผ่านมาแล้ว) */}
            <Button
              size="sm"
              className="h-9 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700"
              onClick={onNewBooking}
              disabled={allPassed}
              title={allPassed ? 'ช่วงเวลาของวันนี้ปิดรับจองแล้วทั้งหมด' : 'จองใหม่'}
            >
              <Plus className="h-4 w-4" /> จองใหม่
            </Button>
          </div>
        </div>
      </div>

      {/* Legend — กติกา: ยังจองได้จนถึง startTime + SLOT_GRACE_MINUTES */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">🕒 ตอนนี้ {format(now, 'HH:mm')} น.</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border border-dashed border-emerald-300 bg-emerald-50" /> ว่าง (กดปุ่มจอง)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded bg-emerald-500" /> ยืนยันแล้ว</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border border-amber-300 bg-amber-100" /> รอชำระ</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border border-dashed border-orange-400 bg-orange-50" /> เริ่มแล้ว (ยังจองได้ — ไม่เกิน {SLOT_GRACE_MINUTES} นาที)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border bg-muted" /> ปิดรับจองแล้ว (เลย {SLOT_GRACE_MINUTES} นาทีหลังเริ่ม)</span>
      </div>

      {/* Grid — สถานะของวันที่เลือก: แถว = ช่วงเวลา, คอลัมน์ = สนาม */}
      {courts.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีสนาม — เพิ่มสนามได้ที่ Dashboard → Court
        </div>
      ) : daySlots.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          ไม่มีช่วงเวลาสำหรับวัน{THAI_DAYS[dayOfWeek]} — เพิ่มช่วงเวลาได้ที่ Settings → ช่วงเวลา
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-20 border-b border-r bg-muted/60 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">เวลา</th>
                {courts.map((c) => (
                  <th key={c.id} className="min-w-[9.5rem] border-b border-l px-3 py-2 text-center">
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">฿{c.pricePerHour.toLocaleString()}/ชม.</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daySlots.map((slot) => (
                <tr key={slot.id} className="border-b last:border-b-0">
                  <th className="sticky left-0 z-10 border-r bg-white px-3 py-1.5 text-left align-middle">
                    <div className="text-xs font-semibold leading-tight">{slot.startTime}</div>
                    <div className="text-[10px] leading-tight text-muted-foreground">{slot.endTime}</div>
                  </th>
                  {courts.map((court) => {
                    const b = occupied.get(`${court.id}|${slot.id}`)
                    if (b) {
                      const meta = statusMeta(b.status)
                      return (
                        <td key={court.id} className="border-l p-1">
                          <button
                            type="button"
                            onClick={() => onEditBooking(b)}
                            title="แก้ไขการจอง"
                            className={`flex h-16 w-full flex-col items-start justify-center gap-0.5 rounded-lg border px-2 text-left transition-colors ${meta.cellClass}`}
                          >
                            <span className="w-full max-w-full truncate text-xs font-semibold">{b.playerName}</span>
                            <span className="w-full max-w-full truncate text-[10px] opacity-90">
                              {meta.label}{b.racketCount > 0 ? ` • ไม้ ${b.racketCount}` : ''}
                            </span>
                          </button>
                        </td>
                      )
                    }
                    const price = getSlotPrice(court.pricePerHour, dayOfWeek, slot.startTime, priceRules)
                    // ปิดรับจองแล้ว (เลย startTime + 20 นาที) → กดจองไม่ได้
                    if (isSlotPassed(date, slot.startTime, now)) {
                      return (
                        <td key={court.id} className="border-l p-1">
                          <div className="flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-muted bg-muted/30 text-muted-foreground/60">
                            <span className="text-[10px] line-through">฿{price.toLocaleString()}</span>
                            <span className="text-[10px]">ปิดรับจอง</span>
                          </div>
                        </td>
                      )
                    }
                    // เริ่มช่วงเวลาแล้ว แต่ยังอยู่ในเวลาผ่อนผัน (20 นาที) → ยังจองได้ (แสดงสีส้ม ไม่มี label)
                    const started = isSlotStarted(date, slot.startTime, now)
                    return (
                      <td key={court.id} className="border-l p-1">
                        <button
                          type="button"
                          onClick={() => onBookSlot({ courtId: court.id, timeSlotId: slot.id, bookingDate: date })}
                          title={started
                            ? `เริ่มแล้ว — ปิดรับจอง ${slotCloseTime(date, slot.startTime)} น.`
                            : 'จองช่องนี้'}
                          className={`group flex h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors ${
                            started
                              ? 'border-orange-400 bg-orange-50 hover:bg-orange-100'
                              : 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-100'
                          }`}
                        >
                          <span className={`text-[11px] font-medium ${started ? 'text-orange-700' : 'text-emerald-700'}`}>฿{price.toLocaleString()}</span>
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white ${
                              started ? 'bg-orange-500 group-hover:bg-orange-600' : 'bg-emerald-600 group-hover:bg-emerald-700'
                            }`}
                          >
                            <Plus className="h-3 w-3" /> จอง
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
