import { addMinutes, format } from 'date-fns'

/**
 * เวลาผ่อนผันหลังเริ่มช่วงเวลา (นาที)
 * เช่น ช่วงเวลา 14:00 - 15:00 จะ "ปิดรับจอง" เมื่อเลย 14:20 ไปแล้ว (จองได้ถึง 14:19)
 * ใช้ร่วมกันทั้งฝั่ง client (ปุ่ม/ช่องในตารางจอง) และฝั่ง server (API) เพื่อให้กติกาตรงกัน
 */
export const SLOT_GRACE_MINUTES = 20

/** รวมวันที่ (yyyy-MM-dd) + เวลา (HH:mm) เป็น Date ตามเวลาท้องถิ่น — null ถ้ารูปแบบไม่ถูกต้อง */
function slotStartAt(bookingDate: string, startTime: string): Date | null {
  const [h, m] = String(startTime || '').split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  const day = new Date(`${bookingDate}T00:00:00`)
  if (isNaN(day.getTime())) return null
  day.setHours(h, m, 0, 0)
  return day
}

/** เวลาที่ช่วงเวลานี้ปิดรับจอง (startTime + เวลาผ่อนผัน) */
export function slotCloseAt(bookingDate: string, startTime: string): Date | null {
  const start = slotStartAt(bookingDate, startTime)
  return start ? addMinutes(start, SLOT_GRACE_MINUTES) : null
}

/** "14:20" — เวลาปิดรับจองของช่วงเวลา 14:00 */
export function slotCloseTime(bookingDate: string, startTime: string): string {
  const close = slotCloseAt(bookingDate, startTime)
  return close ? format(close, 'HH:mm') : ''
}

/** เริ่มช่วงเวลาแล้วหรือยัง (เลย startTime มาแล้ว แต่ยังอยู่ในเวลาผ่อนผัน = ยังจองได้) */
export function isSlotStarted(bookingDate: string, startTime: string, now: Date = new Date()): boolean {
  const start = slotStartAt(bookingDate, startTime)
  return !!start && now.getTime() >= start.getTime()
}

/**
 * ปิดรับจองแล้วหรือยัง
 * - วันก่อนหน้า = ปิดทั้งหมด
 * - วันนี้ = เลย startTime + SLOT_GRACE_MINUTES แล้ว
 * - วันข้างหน้า = ยังเปิดรับจอง
 */
export function isSlotPassed(bookingDate: string, startTime: string, now: Date = new Date()): boolean {
  const todayStr = format(now, 'yyyy-MM-dd')
  if (bookingDate < todayStr) return true
  if (bookingDate > todayStr) return false
  const close = slotCloseAt(bookingDate, startTime)
  return !!close && now.getTime() >= close.getTime()
}
