'use client'

import { CheckCircle2, RotateCcw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useBookingStore } from '@/store/booking-store'
import { useState } from 'react'

interface BookingResult {
  id: string
  ticketCode?: string | null
  court: { id: string; name: string }
  timeSlot: { id: string; startTime: string; endTime: string }
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
  const firstId = bookings[0]?.ticketCode || bookings[0]?.id || ''

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

      {/* Booking tickets — embed the ticket URL page */}
      {bookings.length > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span>ตั๋วการจองของคุณ</span>
                <Badge className="bg-emerald-600">{bookings.length} ใบ</Badge>
              </div>
              <span className="text-[11px] font-normal text-emerald-600 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/ticket/${firstId}` : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="space-y-1.5">
                <div className="rounded-xl border border-emerald-100 overflow-hidden">
                  <iframe
                    src={`/ticket/${b.ticketCode || b.id}`}
                    title={`ตั๋ว ${b.id}`}
                    className="w-full h-[700px] border-0 bg-emerald-50/40"
                    loading="lazy"
                  />
                </div>
                <a
                  href={`/ticket/${b.ticketCode || b.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-emerald-600 underline hover:text-emerald-700 break-all"
                >
                  เปิดหน้าตั๋วออนไลน์ → {`${typeof window !== 'undefined' ? window.location.origin : ''}/ticket/${b.ticketCode || b.id}`}
                </a>
              </div>
            ))}
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
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {myBookings.map((b) => (
                  <div key={b.id} className="space-y-1.5">
                    <div className="rounded-xl border border-emerald-100 overflow-hidden">
                      <iframe
                        src={`/ticket/${b.ticketCode || b.id}`}
                        title={`ตั๋ว ${b.id}`}
                        className="w-full h-[520px] border-0 bg-emerald-50/40"
                        loading="lazy"
                      />
                    </div>
                    <a
                      href={`/ticket/${b.ticketCode || b.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-emerald-600 underline hover:text-emerald-700 break-all"
                    >
                      เปิดหน้าตั๋วออนไลน์ → {`${typeof window !== 'undefined' ? window.location.origin : ''}/ticket/${b.ticketCode || b.id}`}
                    </a>
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
