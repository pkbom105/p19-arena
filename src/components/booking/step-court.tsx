'use client'

import { apiUrl } from '@/lib/api'
import { useEffect, useState } from 'react'
import { MapPin, ArrowLeft, ChevronRight, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useBookingStore } from '@/store/booking-store'
import type { Court } from '@/store/booking-store'

const COURT_COLORS = [
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
]
const COURT_ICONS = ['1', '2', '3', '4', '5', '6']

export function StepCourt() {
  const { courts, setCourts, selectedCourt, setSelectedCourt, setStep, selectedDate, goToStep, bookingItems } = useBookingStore()
  const [loading, setLoading] = useState(true)
  const [allBookings, setAllBookings] = useState<{ courtId: string; timeSlotId: string }[]>([])

  useEffect(() => {
    async function fetchCourts() {
      try {
        const res = await fetch(apiUrl('/api/courts'))
        const data: Court[] = await res.json()
        setCourts(data)
      } catch (err) {
        console.error('Failed to fetch courts', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCourts()
  }, [setCourts])

  // Fetch bookings for this date to show availability per court
  useEffect(() => {
    if (!selectedDate) return
    async function fetchBookings() {
      try {
        const res = await fetch(apiUrl(`/api/bookings?date=${selectedDate}`))
        const data = await res.json()
        setAllBookings(data.map((b: { courtId: string; timeSlotId: string }) => ({ courtId: b.courtId, timeSlotId: b.timeSlotId })))
      } catch {
        // ignore
      }
    }
    fetchBookings()
  }, [selectedDate])

  // Auto-advance to step 4 when court is selected
  useEffect(() => {
    if (selectedCourt) {
      setStep(4)
    }
  }, [selectedCourt, setStep])

  // Count how many time slots are booked for each court on this date
  const getBookedCount = (courtId: string) => {
    return allBookings.filter((b) => b.courtId === courtId).length
  }

  // Check if court is already fully booked by current bookingItems (for same date)
  const isInBookingItems = (courtId: string) => {
    return bookingItems.some((item) => item.date === selectedDate && item.court.id === courtId)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToStep(2)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <MapPin className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">เลือกสนาม</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {selectedDate
          ? `เลือกสนามสำหรับวันที่ ${selectedDate} — จองได้หลายสนามพร้อมกัน`
          : 'P19 Pickleball Arena — เลือกสนามที่ต้องการจอง'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map((court, idx) => {
          const bookedCount = getBookedCount(court.id)
          const alreadyAdded = isInBookingItems(court.id)

          return (
            <Card
              key={court.id}
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] border-2 relative ${
                alreadyAdded
                  ? 'border-amber-400 bg-amber-50'
                  : selectedCourt?.id === court.id
                  ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                  : 'border-transparent hover:border-emerald-200'
              }`}
              onClick={() => setSelectedCourt(court)}
            >
              {alreadyAdded && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-amber-500 text-white text-[10px]">
                    <Check className="h-3 w-3 mr-0.5" />
                    จองแล้ว
                  </Badge>
                </div>
              )}
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className={`${
                    COURT_COLORS[idx % COURT_COLORS.length]
                  } text-white rounded-xl w-14 h-14 flex items-center justify-center text-xl font-bold shrink-0`}
                >
                  {COURT_ICONS[idx % COURT_ICONS.length]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base">{court.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">
                    {court.description || 'P19 Pickleball Arena'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold text-emerald-700">
                      ฿{court.pricePerHour.toLocaleString()}/ชม.
                    </span>
                    {selectedDate && bookedCount > 0 && (
                      <span className="text-[10px] text-red-500">
                        ครบ {bookedCount} ชม.
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}