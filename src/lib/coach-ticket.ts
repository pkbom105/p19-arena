import { db } from '@/lib/db'

/** ข้อมูลโค้ชที่แสดงบนตั๋วการจอง (สรุปจาก CoachBooking ที่ผูกกับแถวสนาม) */
export interface TicketCoachInfo {
  name: string
  hours: number
  pricePerHour: number
  total: number
  /** เวลาเริ่มของแต่ละชั่วโมงที่ติ๊กให้โค้ชดูแล เช่น ["15:00","16:00"] */
  startTimes: string[]
}

/** id ของ Booking (สนาม) ที่ผูกกับ CoachBooking — เก็บเป็น JSON array ใน DB */
export function parseCourtBookingIds(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** เวลาเริ่มของแต่ละชั่วโมงที่โค้ชดูแล — เก็บใน DB เป็น "09:00,10:00" */
function parseStartTimes(value: string | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t))
    .sort()
}

/**
 * ดึงข้อมูลโค้ชของตั๋วสนามหลายใบในครั้งเดียว (คีย์ = booking id)
 * — ตั๋วสนาม 1 ใบ จะมี CoachBooking ได้ไม่เกิน 1 แถว (ไม่นับที่ถูกยกเลิก)
 */
export async function getCoachMapByBookingIds(ids: string[]): Promise<Map<string, TicketCoachInfo>> {
  const map = new Map<string, TicketCoachInfo>()
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return map

  const rows = await db.coachBooking.findMany({
    where: {
      status: { not: 'cancelled' },
      OR: unique.map((id) => ({ courtBookingIds: { contains: id } })),
    },
    orderBy: { createdAt: 'desc' },
  })

  for (const row of rows) {
    const info: TicketCoachInfo = {
      name: row.coachName,
      hours: row.hours,
      pricePerHour: row.coachPrice,
      total: row.coachTotal,
      startTimes: parseStartTimes(row.startTimes),
    }
    for (const bookingId of parseCourtBookingIds(row.courtBookingIds)) {
      // แถวที่สร้างล่าสุดชนะ (orderBy desc) → ไม่ทับของเดิม
      if (!map.has(bookingId)) map.set(bookingId, info)
    }
  }
  return map
}

/** แนบข้อมูลโค้ชให้แถวการจอง (คืน object ใหม่ ไม่แก้ต้นฉบับ) — ไม่พบโค้ช = null */
export async function attachCoachToBookings<T extends { id: string }>(
  rows: T[]
): Promise<(T & { coach: TicketCoachInfo | null })[]> {
  const map = await getCoachMapByBookingIds(rows.map((r) => r.id))
  return rows.map((row) => ({ ...row, coach: map.get(row.id) ?? null }))
}
