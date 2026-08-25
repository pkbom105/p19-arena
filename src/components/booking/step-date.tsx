'use client'

import { useEffect } from 'react'
import { format, addDays, isToday, isTomorrow } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useBookingStore } from '@/store/booking-store'

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export function StepDate() {
  const { selectedDate, setSelectedDate, setStep } = useBookingStore()

  useEffect(() => {
    if (selectedDate) {
      setStep(2)
    }
  }, [selectedDate, setStep])

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i)
    return {
      value: format(d, 'yyyy-MM-dd'),
      day: THAI_DAYS[d.getDay()],
      date: d.getDate(),
      month: THAI_MONTHS_SHORT[d.getMonth()],
      isToday: isToday(d),
      isTomorrow: isTomorrow(d),
      dayOfWeek: d.getDay(),
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">เลือกวันที่ต้องการเล่น</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        เลือกวันที่ต้องการจองสนาม Pickleball
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {dates.map((d) => (
          <Card
            key={d.value}
            className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-2 ${
              selectedDate === d.value
                ? 'border-emerald-500 bg-emerald-50 shadow-md'
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
