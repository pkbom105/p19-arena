'use client'

import { apiUrl, BASE_PATH } from '@/lib/api'
import { getSlotPrice, type PriceRule } from '@/lib/price'
import { toast } from 'sonner'
import type { BookingRow, Court } from './types'

// อาร์เรย์เดือน/วันไทย + ตัวจัดรูปแบบวันที่ — ใช้ตัวกลางจาก lib/thai-date (เดิมนิยามซ้ำในไฟล์นี้)
export { THAI_MONTHS, THAI_DAYS, formatThaiDateFullDay as formatThaiDate } from '@/lib/thai-date'

export const STATUS_META: Record<string, { label: string; badgeClass: string; cellClass: string }> = {
  pending: {
    label: 'รอชำระ',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    cellClass: 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-900',
  },
  confirmed: {
    label: 'ยืนยันแล้ว',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cellClass: 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600 text-white',
  },
  cancelled: {
    label: 'ยกเลิก',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    cellClass: '',
  },
}

export function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, badgeClass: 'bg-muted text-muted-foreground', cellClass: '' }
}

export const isActiveStatus = (s: string) => s === 'pending' || s === 'confirmed'

/** คัดลอกลิงก์ตั๋วการจอง */
export async function copyTicketLink(booking: BookingRow) {
  const code = booking.ticketCode || booking.id
  const url = `${window.location.origin}${BASE_PATH}/ticket/${code}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success('คัดลอกลิงก์ตั๋วแล้ว')
  } catch {
    toast.error('คัดลอกไม่สำเร็จ')
  }
}

/** ราคาของการจอง 1 ช่อง (คิดตาม price rules ของวัน/เวลานั้น) */
export function bookingPrice(b: BookingRow, courts: Court[], priceRules: PriceRule[]): number {
  const court = courts.find((c) => c.id === b.courtId)
  if (!court || !b.timeSlot?.startTime) return 0
  const day = new Date(b.bookingDate + 'T00:00:00').getDay()
  return getSlotPrice(court.pricePerHour, day, b.timeSlot.startTime, priceRules)
}

// กติกาเวลาจอง (เวลาผ่อนผัน 20 นาทีหลังเริ่มช่วงเวลา) อยู่ใน "@/lib/slot-time"
// เพื่อให้ฝั่ง client (ตาราง/ปุ่มจอง) กับฝั่ง server (API) ใช้กติกาเดียวกัน
// เช่น isSlotPassed(date, startTime) = ปิดรับจองเมื่อเลย startTime + SLOT_GRACE_MINUTES
