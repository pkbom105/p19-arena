import type { TicketCoachInfo } from '@/lib/coach-ticket'

/**
 * ตัวช่วยรวม "ตั๋วการจอง" ให้เป็นใบเดียว ตามเงื่อนไขธุรกิจของ P19
 *  - สนามเดียวกัน + วันเดียวกัน + ผู้จองคนเดียวกัน + เวลาติดกัน (endTime ต่อกับ startTime) → ตั๋วใบเดียว
 *  - คนละสนาม / คนละวัน / เวลาห่างกัน → แยกตั๋วคนละใบ
 *  - แถวที่ถูกยกเลิก → ไม่ถูกรวมกับใคร (ยืนเป็นใบของตัวเอง)
 * ใช้ร่วมกันทั้งหน้าตั๋ว (/ticket/[id]) หน้าจองสำเร็จ (step-success) และหน้าที่แสดงตั๋วอื่น ๆ (/check, dashboard, POS)
 */

/** ข้อมูลขั้นต่ำของแถวการจองที่ต้องใช้จัดกลุ่ม (subset ของ Booking) */
export interface GroupableTicket {
  id: string
  bookingDate: string
  status: string
  playerPhone?: string
  court: { id: string; name: string }
  timeSlot: { startTime: string; endTime: string }
}

/** สรุปช่วงเวลาของกลุ่มตั๋ว */
export interface TicketGroupSummary {
  startTime: string
  endTime: string
  /** จำนวนช่อง (สล็อต) ที่ถูกรวมในใบเดียว */
  slotCount: number
  /** ชั่วโมงรวมของช่วงเวลาที่รวม (endTime - startTime) */
  hours: number
}

/** "HH:MM" → นาทีนับจากเที่ยงคืน */
export function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm ?? '').split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.NaN
  return h * 60 + m
}

/** จำนวนชั่วโมงแบบไทยอ่านง่าย — 3 / 1.5 (ไม่โชว์ .0) */
export function formatSlotHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

/**
 * จัดกลุ่มแถวการจองตาม "สนาม + วัน + ผู้จอง + เวลาติดกัน"
 * คืน array ของกลุ่ม โดยแต่ละกลุ่มเรียงตามเวลาเริ่ม และกลุ่มถูกเรียงตามวัน+เวลาเริ่ม
 */
export function groupTicketsByCourtAndContiguity<T extends GroupableTicket>(rows: T[]): T[][] {
  const groups: T[][] = []
  const buckets = new Map<string, T[]>()

  for (const row of rows ?? []) {
    if (row.status === 'cancelled') {
      groups.push([row]) // ยกเลิกแล้ว → ไม่รวมกับใคร
      continue
    }
    const key = [row.bookingDate, row.court?.id ?? '', row.playerPhone ?? ''].join('|')
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  for (const bucket of buckets.values()) {
    const sorted = [...bucket].sort((a, b) => toMinutes(a.timeSlot.startTime) - toMinutes(b.timeSlot.startTime))
    let current: T[] = []
    for (const row of sorted) {
      const prev = current[current.length - 1]
      const contiguous = !!prev && prev.timeSlot.endTime === row.timeSlot.startTime
      if (contiguous) {
        current.push(row)
      } else {
        if (current.length > 0) groups.push(current)
        current = [row]
      }
    }
    if (current.length > 0) groups.push(current)
  }

  // เรียงกลุ่มตามวัน + เวลาเริ่ม เพื่อให้ลำดับตั๋วคงที่ทุกครั้งที่ render
  return groups.sort((a, b) => {
    const ka = `${a[0].bookingDate} ${a[0].timeSlot.startTime}`
    const kb = `${b[0].bookingDate} ${b[0].timeSlot.startTime}`
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

/** สรุปช่วงเวลา + ชั่วโมงของกลุ่มตั๋ว (ใช้แสดงบนตั๋วใบเดียว) */
export function summarizeTicketGroup<T extends GroupableTicket>(group: T[]): TicketGroupSummary {
  const sorted = [...(group ?? [])].sort((a, b) => toMinutes(a.timeSlot.startTime) - toMinutes(b.timeSlot.startTime))
  const startTime = sorted[0]?.timeSlot.startTime ?? ''
  const endTime = sorted[sorted.length - 1]?.timeSlot.endTime ?? ''
  const hours = sorted.length > 0 ? (toMinutes(endTime) - toMinutes(startTime)) / 60 : 0
  return { startTime, endTime, slotCount: sorted.length, hours }
}

/** แถวการจองที่มีข้อมูลโค้ชแนบมาด้วย (จาก /api/bookings หรือ /api/my-bookings) */
export interface TicketViewRow extends GroupableTicket {
  coach?: TicketCoachInfo | null
}

/** "ตั๋ว" 1 ใบ = กลุ่มแถวที่เวลาติดกัน + เวลา/ชั่วโมงรวม + โค้ชเฉพาะชั่วโมงที่ติ๊กและอยู่ในใบนี้ */
export interface TicketView<T extends TicketViewRow> {
  /** แถวแรกสุดของกลุ่ม — ตัวแทนของใบนี้ (รหัสที่แสดงบนตั๋ว = รหัสของแถวนี้) */
  lead: T
  rows: T[]
  startTime: string
  endTime: string
  slotCount: number
  hours: number
  coach: TicketCoachInfo | null
}

/**
 * จัดกลุ่มแถวการจองเป็น "มุมมองตั๋ว" (ใบเดียวต่อกลุ่มเวลาติดกัน)
 *  - เวลา/ชั่วโมง = ช่วงรวมของกลุ่ม (แสดง "15:00 - 18:00 น. · 3 ชม.")
 *  - โค้ช = ชั่วโมงที่ติ๊กไว้เฉพาะที่อยู่ในช่วงเวลาของใบนี้ (คิดราคาตามจำนวนจริง)
 * ใช้ได้ทั้ง client และ server — ไม่แตะ DB เพื่อให้ทุกหน้าแสดงผลตรงกัน
 */
export function buildTicketViews<T extends TicketViewRow>(rows: T[]): TicketView<T>[] {
  return groupTicketsByCourtAndContiguity(rows ?? []).map((group) => {
    const summary = summarizeTicketGroup(group)
    // โค้ชของใบนี้: ใช้แถวแรกที่มีข้อมูลโค้ช (กลุ่มที่สร้างจากระบบใหม่ใช้ CoachBooking แถวเดียวกันทั้งกลุ่ม)
    const coachRow = group.find((row) => !!row.coach)
    const slotStartTimes = group.map((row) => row.timeSlot.startTime)
    const coachTimes = coachRow?.coach
      ? [...new Set(coachRow.coach.startTimes ?? [])].filter((t) => slotStartTimes.includes(t)).sort()
      : []
    const coach =
      coachRow?.coach && coachTimes.length > 0
        ? {
            ...coachRow.coach,
            startTimes: coachTimes,
            hours: coachTimes.length,
            total: coachTimes.length * coachRow.coach.pricePerHour,
          }
        : null

    return {
      lead: group[0],
      rows: group,
      startTime: summary.startTime,
      endTime: summary.endTime,
      slotCount: summary.slotCount,
      hours: summary.hours,
      coach,
    }
  })
}

/**
 * ใส่ข้อมูลระดับกลุ่ม (เวลา/ชั่วโมงรวม/โค้ชของใบ) ลงบนแถวเดิม เพื่อให้ BookingTicket แสดงเป็นใบรวม
 * — ใช้กับการ์ดรายแถว (เช่น หน้าแอดมินที่ปุ่มแก้ไข/ยกเลิก/คัดลอกลิงก์ต้องยึดแถวที่ผู้ใช้กด)
 */
export function mergeTicketView<T extends TicketViewRow>(
  row: T,
  view?: TicketView<T>
): T & { slotCount: number; coach: TicketCoachInfo | null } {
  if (!view) return { ...row, slotCount: 1, coach: row.coach ?? null }
  return {
    ...row,
    timeSlot: { ...row.timeSlot, startTime: view.startTime, endTime: view.endTime },
    slotCount: view.slotCount,
    coach: view.coach,
  }
}

/**
 * เวลาโค้ชที่โชว์บนตั๋ว
 *  - ติ๊กติดกันหลายชั่วโมง → แสดงเป็นช่วง "09:00 - 12:00 น."
 *  - ติ๊กแบบมีช่องว่าง → ไล่รายชั่วโมง "09:00, 11:00 น."
 */
export function formatCoachTimes(startTimes: string[]): string {
  const times = [...new Set((startTimes ?? []).filter(Boolean))].sort()
  if (times.length === 0) return ''
  const contiguous = times.every((t, i) => i === 0 || toMinutes(t) - toMinutes(times[i - 1]) === 60)
  if (contiguous && times.length > 1) {
    const end = toMinutes(times[times.length - 1]) + 60
    const endLabel = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
    return `${times[0]} - ${endLabel} น.`
  }
  return `${times.join(', ')} น.`
}
