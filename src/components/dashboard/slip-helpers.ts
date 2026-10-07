'use client'

/* ค่าคงที่/ตัวช่วย + ชนิดข้อมูลที่ใช้ร่วมกันในแผงสลิป (Dashboard → Slip Upload) */

/** ข้อมูลการจองขั้นต่ำที่ต้องใช้ในแผงสลิป (slipDataUrl / slipName มาจาก /api/bookings) */
export interface SlipBooking {
  id: string
  ticketCode?: string | null
  bookingDate: string
  status: string
  playerName: string
  playerPhone: string
  racketCount?: number
  slipName?: string | null
  slipDataUrl?: string | null
  court: { id: string; name: string }
  timeSlot: { id: string; startTime: string; endTime: string }
}

// อาร์เรย์เดือน + ตัวจัดรูปแบบวันที่ไทย — ใช้ตัวกลางจาก lib/thai-date
export { THAI_MONTHS, formatThaiDate } from '@/lib/thai-date'

export const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'รอชำระ', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'ยืนยันแล้ว', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ยกเลิก', className: 'bg-muted text-muted-foreground border-border' },
}

export const statusMeta = (status: string) =>
  STATUS_META[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' }

/** ขนาดสลิปสูงสุด — ตรงกับหน้าองของลูกค้า (slip-upload-card / step-confirm / /api/my-bookings) */
export const MAX_SLIP_SIZE = 300 * 1024

export type StatusFilter = 'all' | 'pending' | 'confirmed'
export type Scope = 'slips' | 'all'
