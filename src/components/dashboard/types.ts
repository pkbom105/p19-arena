/* Shared types for the Dashboard page & components */

export interface Court {
  id: string
  name: string
  description: string | null
  pricePerHour: number
  isActive: boolean
  sortOrder: number
}

export interface Equipment {
  id: string
  name: string
  nameEn: string | null
  pricePerUnit: number
  isActive: boolean
  sortOrder: number
}

export interface Settings {
  arena_name?: string
  arena_phone?: string
  arena_address?: string
  [key: string]: string | undefined
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
  createdAt?: string
  ticketCode?: string | null
  courtId: string
  timeSlotId: string
  bookingDate: string
  status: string
  playerName: string
  playerPhone: string
  playerEmail: string | null
  note: string | null
  racketCount: number
  slipName?: string | null
  slipDataUrl?: string | null
  court: { id: string; name: string }
  timeSlot: { id: string; startTime: string; endTime: string }
}

export interface LineMember {
  id: string
  lineUserId: string | null
  lineDisplayName: string | null
  linePictureUrl: string | null
  name: string | null
  phone: string | null
  createdAt: string
  _count: { bookings: number }
}

export interface MessagingStatus {
  connected: boolean
  channelId?: string
  tokenExpiresAt?: string | null
}

export interface Stats {
  totals: { bookings: number; courts: number; equipment: number; priceRules: number; users: number }
  status: { pending: number; confirmed: number; cancelled: number }
  today: {
    date: string
    count: number
    activeCount: number
    revenueEstimate: number
    byCourt: { courtId: string; name: string; count: number; revenueEstimate: number }[]
    bookings: { id: string; bookingDate: string; status: string; playerName: string; court?: { name: string }; timeSlot?: { startTime: string; endTime: string } }[]
  }
  upcoming: number
  recent: { id: string; bookingDate: string; status: string; playerName: string; court?: { name: string }; timeSlot?: { startTime: string; endTime: string } }[]
}
