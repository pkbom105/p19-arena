'use client'

import { CheckCircle2, RotateCcw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useBookingStore } from '@/store/booking-store'
import { useState } from 'react'

interface BookingResult {
  id: string
  court: { name: string }
  timeSlot: { startTime: string; endTime: string }
  bookingDate: string
  playerName: string
  playerPhone: string
  status: string
}

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

export function StepSuccess() {
  const {
    submittedBookings,
    resetBookingForm,
    setStep,
    setSelectedCourt,
    setSelectedDate,
    clearTimeSlots,
    setLineLoginSkipped,
    clearAllBookingItems,
  } = useBookingStore()
  const [showLookup, setShowLookup] = useState(false)
  const [lookupPhone, setLookupPhone] = useState('')
  const [myBookings, setMyBookings] = useState<BookingResult[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)

  const bookings = submittedBookings as BookingResult[]
  const first = bookings[0]

  // Group bookings by date + court
  const grouped = bookings.reduce<Record<string, BookingResult[]>>((acc, b) => {
    const key = `${b.bookingDate}__${b.court.name}`
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  const handleNewBooking = () => {
    resetBookingForm()
    setSelectedCourt(null)
    setSelectedDate('')
    clearTimeSlots()
    setLineLoginSkipped(false)
    clearAllBookingItems()
    setStep(1)
  }

  const handleLookup = async () => {
    if (!lookupPhone.trim()) return
    setLookupLoading(true)
    try {
      const res = await fetch(`/api/my-bookings?playerPhone=${encodeURIComponent(lookupPhone)}`)
      const data = await res.json()
      setMyBookings(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      <div className="text-center space-y-3 py-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold">จองสนามสำเร็จ!</h2>
        <p className="text-muted-foreground">
          จองสำเร็จ {bookings.length} รายการ
        </p>
      </div>

      {/* Booking details - grouped by date/court */}
      {bookings.length > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>รายละเอียดการจอง</span>
              <Badge className="bg-emerald-600">{bookings.length} รายการ</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ชื่อ</span>
              <span className="font-medium">{first.playerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">เบอร์โทร</span>
              <span className="font-medium">{first.playerPhone}</span>
            </div>
            <Separator />

            {Object.entries(grouped).map(([key, groupBookings]) => {
              const [dateStr, courtName] = key.split('__')
              const sorted = [...groupBookings].sort(
                (a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
              )
              return (
                <div key={key} className="space-y-1.5">
                  <div className="text-sm font-medium text-emerald-700">
                    {formatDate(dateStr)} — {courtName}
                  </div>
                  {sorted.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm font-medium">
                        {b.timeSlot.startTime} - {b.timeSlot.endTime} น.
                      </span>
                      <Badge
                        variant="outline"
                        className="text-emerald-700 border-emerald-300 text-[11px]"
                      >
                        {b.status === 'confirmed' ? 'ยืนยันแล้ว' : b.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Lookup past bookings */}
      {!showLookup ? (
        <Button variant="outline" className="w-full" onClick={() => setShowLookup(true)}>
          <Search className="h-4 w-4 mr-2" />
          ตรวจสอบการจองของคุณ
        </Button>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium text-sm">ค้นหาด้วยเบอร์โทร</h3>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="0XX-XXX-XXXX"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" onClick={handleLookup} disabled={lookupLoading}>
                {lookupLoading ? '...' : 'ค้นหา'}
              </Button>
            </div>
            {myBookings.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex justify-between items-center p-2 bg-muted rounded-lg text-sm"
                  >
                    <div>
                      <div className="font-medium">{b.court.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatDate(b.bookingDate)} | {b.timeSlot.startTime}-{b.timeSlot.endTime}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {b.status === 'confirmed' ? 'ยืนยันแล้ว' : b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {myBookings.length === 0 && lookupPhone && !lookupLoading && (
              <p className="text-xs text-muted-foreground text-center">ไม่พบประวัติการจอง</p>
            )}
          </CardContent>
        </Card>
      )}

      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleNewBooking}>
        <RotateCcw className="h-4 w-4 mr-2" />
        จองสนามเพิ่มเติม
      </Button>
    </div>
  )
}
