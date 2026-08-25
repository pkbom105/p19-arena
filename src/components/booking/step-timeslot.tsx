'use client'

import { useEffect, useState } from 'react'
import { Clock, ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useBookingStore } from '@/store/booking-store'
import type { TimeSlot } from '@/store/booking-store'

function formatPrice(amount: number) {
  return amount.toLocaleString()
}

export function StepTimeSlot() {
  const {
    selectedDate,
    selectedCourt,
    timeSlots,
    setTimeSlots,
    bookedSlots,
    setBookedSlots,
    selectedTimeSlots,
    toggleTimeSlot,
    clearTimeSlots,
    addBookingItem,
    setStep,
    goToStep,
  } = useBookingStore()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedDate) return

    async function fetchAll() {
      setLoading(true)
      try {
        const [slotsRes, bookingsRes] = await Promise.all([
          fetch(`/api/timeslots?date=${selectedDate}`),
          fetch(`/api/bookings?date=${selectedDate}${selectedCourt ? `&courtId=${selectedCourt.id}` : ''}`),
        ])
        const slotsData: TimeSlot[] = await slotsRes.json()
        const bookingsData = await bookingsRes.json()
        setTimeSlots(slotsData)
        setBookedSlots(bookingsData.map((b: { timeSlotId: string; courtId: string }) => `${b.courtId}-${b.timeSlotId}`))
      } catch (err) {
        console.error('Failed to fetch slots/bookings', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [selectedDate, selectedCourt, setTimeSlots, setBookedSlots])

  const isBooked = (slotId: string) =>
    selectedCourt ? bookedSlots.includes(`${selectedCourt.id}-${slotId}`) : false

  const isSelected = (slotId: string) =>
    selectedTimeSlots.some((s) => s.id === slotId)

  const isPast = (startTime: string) => {
    if (selectedDate !== new Date().toISOString().split('T')[0]) return false
    const now = new Date()
    const [h, m] = startTime.split(':').map(Number)
    return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)
  }

  const handleProceed = () => {
    if (selectedTimeSlots.length > 0) {
      addBookingItem()
      setStep(4)
    }
  }

  const pricePerSlot = selectedCourt?.pricePerHour || 0
  const totalPrice = selectedTimeSlots.length * pricePerSlot

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const morningSlots = timeSlots.filter((s) => parseInt(s.startTime) < 12)
  const afternoonSlots = timeSlots.filter((s) => {
    const h = parseInt(s.startTime)
    return h >= 12 && h < 17
  })
  const eveningSlots = timeSlots.filter((s) => parseInt(s.startTime) >= 17)

  const renderGroup = (label: string, slots: TimeSlot[]) => {
    if (slots.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
          <span className="text-[11px] text-muted-foreground">฿{formatPrice(pricePerSlot)}/ชม.</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {slots.map((slot) => {
            const booked = isBooked(slot.id)
            const past = isPast(slot.startTime)
            const disabled = booked || past
            const selected = isSelected(slot.id)

            return (
              <Card
                key={slot.id}
                className={`transition-all border-2 relative ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed border-transparent bg-muted/50'
                    : selected
                    ? 'border-emerald-500 bg-emerald-50 cursor-pointer shadow-md'
                    : 'border-transparent cursor-pointer hover:border-emerald-200 hover:shadow-md'
                }`}
                onClick={() => {
                  if (!disabled) toggleTimeSlot(slot)
                }}
              >
                {selected && !disabled && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                )}
                <CardContent className="p-3 text-center">
                  {booked && (
                    <Badge variant="secondary" className="text-[10px] mb-1 bg-red-100 text-red-600">
                      จองแล้ว
                    </Badge>
                  )}
                  {past && !booked && (
                    <Badge variant="secondary" className="text-[10px] mb-1 bg-gray-100 text-gray-500">
                      ผ่านมาแล้ว
                    </Badge>
                  )}
                  <div className="font-semibold text-sm">{slot.startTime}</div>
                  <div className="text-xs text-muted-foreground">{slot.endTime}</div>
                  {!disabled && (
                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                      ฿{formatPrice(pricePerSlot)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { goToStep(2) }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Clock className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">เลือกเวลา</h2>
        {selectedTimeSlots.length > 0 && (
          <Badge className="bg-emerald-500 text-white ml-auto">
            {selectedTimeSlots.length} ช่วงเวลา
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {selectedCourt?.name} — {selectedDate} — ฿{formatPrice(pricePerSlot)}/ชม.
      </p>

      {renderGroup('🌙 เช้า', morningSlots)}
      {renderGroup('☀️ บ่าย', afternoonSlots)}
      {renderGroup('🌆 เย็น', eveningSlots)}

      {selectedTimeSlots.length > 0 && (
        <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm border-t pt-3 pb-1 -mx-4 px-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              เลือกแล้ว <span className="font-semibold text-emerald-600">{selectedTimeSlots.length}</span> ช่วงเวลา
            </span>
            <span className="text-sm font-semibold text-emerald-700">
              ฿{formatPrice(totalPrice)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedTimeSlots
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full"
                >
                  {s.startTime}-{s.endTime}
                  <button
                    type="button"
                    className="hover:text-red-500"
                    onClick={() => toggleTimeSlot(s)}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-red-500"
              onClick={clearTimeSlots}
            >
              ล้างทั้งหมด
            </button>
            <span className="text-xs text-muted-foreground">
              ฿{formatPrice(pricePerSlot)} × {selectedTimeSlots.length} ชม. = <span className="font-semibold text-emerald-700">฿{formatPrice(totalPrice)}</span>
            </span>
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={handleProceed}
          >
            ถัดไป
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
