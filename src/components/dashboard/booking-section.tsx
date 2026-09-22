'use client'

import type { Dispatch, SetStateAction } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { BookingTicket } from '@/components/booking/booking-ticket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingForm } from './booking-form'
import type { BookingRow, Court, TimeSlotItem } from './types'

interface BookingSectionProps {
  bookings: BookingRow[]
  courts: Court[]
  timeSlots: TimeSlotItem[]
  editingBooking: BookingRow | null
  setEditingBooking: Dispatch<SetStateAction<BookingRow | null>>
  handleUpdateBooking: (data: Partial<BookingRow>) => void
  handleCancelBooking: (id: string) => void
  handleCopyTicketLink: (booking: BookingRow) => void
  refreshing: boolean
  refreshBookings: () => void
  saving: boolean
}

/** Booking Tickets — ตั๋วการจองทั้งหมด แก้ไข/ยกเลิก/คัดลอกลิงก์ได้ */
export function BookingSection({ bookings, courts, timeSlots, editingBooking, setEditingBooking, handleUpdateBooking, handleCancelBooking, handleCopyTicketLink, refreshing, refreshBookings, saving }: BookingSectionProps) {
  return (
    <>
      {/* Customer Bookings Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              การจองของลูกค้า
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={refreshBookings}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            รายการจองที่ลูกค้าได้จองไว้ และบันทึกแล้ว — แก้ไขวัน/เวลา/สนาม/ข้อมูล หรือยกเลิกได้ (เรียงวันที่ล่าสุด→อนาคต ซ้าย→ขวา)
          </p>

          {bookings.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีการจอง</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {[...bookings]
            .sort((a, b) =>
              (b.bookingDate ?? '').localeCompare(a.bookingDate ?? '') ||
              (b.timeSlot?.startTime ?? '').localeCompare(a.timeSlot?.startTime ?? '')
            )
            .map((b) => (
            <div key={b.id} className={editingBooking?.id === b.id ? 'sm:col-span-2 xl:col-span-4' : ''}>
              {editingBooking?.id === b.id ? (
                <BookingForm
                  initial={b}
                  courts={courts}
                  timeSlots={timeSlots}
                  onSave={handleUpdateBooking}
                  onCancel={() => setEditingBooking(null)}
                  saving={saving}
                />
              ) : (
                <BookingTicket
                  booking={b}
                  onEdit={() => setEditingBooking(b)}
                  onCancel={() => handleCancelBooking(b.id)}
                  onCopyLink={() => handleCopyTicketLink(b)}
                />
              )}
            </div>
          ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
