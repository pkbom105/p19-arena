/* Shared types for the POS page & components */

export interface Court {
  id: string
  name: string
  description: string | null
  pricePerHour: number
  isActive: boolean
  sortOrder: number
}

export interface TimeSlotItem {
  id: string
  startTime: string
  endTime: string
  dayOfWeek: number
  isActive: boolean
  sortOrder: number
}

export interface BookingRow {
  id: string
  ticketCode?: string | null
  createdAt?: string
  courtId: string
  timeSlotId: string
  bookingDate: string
  status: string
  playerName: string
  playerPhone: string
  playerEmail: string | null
  note: string | null
  racketCount: number
  court: { id: string; name: string }
  timeSlot: { id: string; startTime: string; endTime: string }
}

/** preset สำหรับเปิด dialog "จองใหม่" — court/slot อาจยังไม่ได้เลือก (กดปุ่ม "จองใหม่") */
export interface NewBookingPreset {
  courtId?: string
  timeSlotId?: string
  bookingDate: string
}
