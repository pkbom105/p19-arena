'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, addDays, isToday, isTomorrow, startOfToday, parse } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarDays, CalendarIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useBookingStore } from '@/store/booking-store'

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** เปิดจองล่วงหน้าได้ไม่เกิน 42 วัน */
const MAX_ADVANCE_DAYS = 42
/** หน้าจองแสดงผล 21 วัน (วันที่เกินจากนี้เลือกได้จากปฏิทิน) */
const DISPLAY_DAYS = 21

export function StepDate() {
  const { selectedDate, setSelectedDate, setStep } = useBookingStore()
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    if (selectedDate) {
      setStep(2)
    }
  }, [selectedDate, setStep])

  const minDate = useMemo(() => startOfToday(), [])
  const maxDate = useMemo(() => addDays(new Date(), MAX_ADVANCE_DAYS), [])

  const dates = Array.from({ length: DISPLAY_DAYS }, (_, i) => {
    const d = addDays(new Date(), i)
    const dayOfWeek = d.getDay()
    return {
      value: format(d, 'yyyy-MM-dd'),
      day: THAI_DAYS[dayOfWeek],
      date: d.getDate(),
      month: THAI_MONTHS_SHORT[d.getMonth()],
      isToday: isToday(d),
      isTomorrow: isTomorrow(d),
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // เสาร์ / อาทิตย์
    }
  })

  const selectedDateObj = useMemo(
    () => (selectedDate ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : undefined),
    [selectedDate]
  )

  // วันที่เลือกอยู่นอกช่วง 21 วันที่แสดง (เลือกมาจากปฏิทิน)
  const isSelectedOutsideCards =
    !!selectedDate && !dates.some((d) => d.value === selectedDate)

  const handleCalendarSelect = (d?: Date) => {
    if (!d) return
    setSelectedDate(format(d, 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">เลือกวันที่ต้องการเล่น</h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          เลือกวันที่ต้องการจองสนาม Pickleball
          <span className="ml-2 inline-block rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
            เปิดจองล่วงหน้าได้ {MAX_ADVANCE_DAYS} วัน
          </span>
        </p>

        {/* Date picker: เลือกวันได้ถึง 42 วันล่วงหน้า */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
              <CalendarIcon className="h-4 w-4" />
              {selectedDateObj
                ? format(selectedDateObj, 'd MMM yy', { locale: th })
                : 'เลือกจากปฏิทิน'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={th}
              selected={selectedDateObj}
              onSelect={handleCalendarSelect}
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

      {isSelectedOutsideCards && selectedDateObj && (
        <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          วันที่เลือก: {format(selectedDateObj, 'EEEE d MMMM yy', { locale: th })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {dates.map((d) => (
          <Card
            key={d.value}
            className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-2 ${
              selectedDate === d.value
                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                : d.isWeekend
                  ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
                  : 'border-transparent hover:border-emerald-200'
            }`}
            onClick={() => setSelectedDate(d.value)}
          >
            <CardContent className="p-3 text-center">
              <div className="text-xs font-medium text-muted-foreground">
                {d.isToday ? 'วันนี้' : d.isTomorrow ? 'พรุ่งนี้' : d.day}
              </div>
              <div className="text-2xl font-bold mt-1">{d.date}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{d.month}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
