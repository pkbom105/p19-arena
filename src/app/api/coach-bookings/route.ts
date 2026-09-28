import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { addDays, format } from 'date-fns'
import { th } from 'date-fns/locale'
import { generateTicketCode } from '@/lib/ticket-code'
import { getSlotPrice } from '@/lib/price'
import { SLOT_GRACE_MINUTES, isSlotPassed } from '@/lib/slot-time'
import { COACH_PACKAGES, COACH_SLOT_TIMES } from '@/components/activity/coaches'

/**
 * /api/coach-bookings — การจองโค้ช "ของจริง"
 * ยอดชำระ = ค่าสนาม (คิดตาม PriceRule ของวันนั้น) + ค่าโค้ช (ราคา/ชม. × จำนวนชั่วโมง)
 * ตอนจองจะสร้างแถว Booking ของสนามคู่กันทุกชั่วโมง → สนามถูกกันจริงในกริดจองสนาม
 */

/** ขนาดสลิปสูงสุด — ตรงกับฝั่ง UI (coach-booking) และ /api/my-bookings */
const MAX_SLIP_BYTES = 300 * 1024
/** จองล่วงหน้าได้ไม่เกิน 42 วัน — เท่ากับ /api/bookings */
const MAX_ADVANCE_DAYS = 42
/** สถานะที่นับว่า "ยังกินคิวอยู่" */
const ACTIVE_STATUSES = ['pending', 'confirmed']
const VALID_STATUSES = ['pending', 'confirmed', 'cancelled']

/** ประเมินขนาดไฟล์จาก data URL (base64) โดยไม่ต้อง decode */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = (base64.match(/=+$/) ?? [''])[0].length
  return Math.floor((base64.length * 3) / 4) - padding
}

/** "09:00,10:00" หรือ ["09:00","10:00"] → ["09:00","10:00"] (ไม่ซ้ำ + เรียงตามเวลา) */
function parseStartTimes(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map((v) => String(v)) : String(value ?? '').split(',')
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort()
}

/** id ของ Booking (สนาม) ที่ผูกไว้ — เก็บเป็น JSON string */
function parseCourtBookingIds(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
  } catch {
    return []
  }
}

/** สร้าง CoachBooking โดยพยายาม ticketCode ที่ไม่ซ้ำ (retry เมื่อชนกัน) */
async function createCoachBookingWithUniqueCode(
  data: Omit<Prisma.CoachBookingUncheckedCreateInput, 'ticketCode'>
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await db.coachBooking.create({ data: { ...data, ticketCode: generateTicketCode() } })
    } catch (error) {
      const e = error as { code?: string }
      if (e.code === 'P2002') continue // ticketCode ชนกัน → ลองใหม่
      throw error
    }
  }
  throw new Error('ไม่สามารถสร้างรหัสตั๋วที่ไม่ซ้ำได้')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const coachId = searchParams.get('coachId')
    const playerPhone = searchParams.get('playerPhone')
    const ticketCode = searchParams.get('ticketCode')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (date) where.bookingDate = date
    if (coachId) where.coachId = coachId
    if (playerPhone) where.playerPhone = playerPhone
    // รหัสตั๋วเก็บเป็นตัวพิมพ์ใหญ่เสมอ
    if (ticketCode) where.ticketCode = ticketCode.trim().toUpperCase()
    if (status) where.status = status

    const rows = await db.coachBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching coach bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch coach bookings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  /** แถวสนามที่ "สร้างใหม่" รอบนี้ — ใช้ rollback ถ้าสร้างไม่สำเร็จกลางทาง */
  const createdCourtRowIds: string[] = []
  try {
    const body = await request.json()
    const {
      coachId, courtId, bookingDate, startTimes,
      playerName, playerPhone, playerEmail, note, slipName, slipDataUrl,
    } = body ?? {}

    const coach = COACH_PACKAGES.find((c) => c.id === String(coachId ?? ''))
    if (!coach) {
      return NextResponse.json({ error: 'ไม่พบแพ็กเกจโค้ชที่เลือก' }, { status: 400 })
    }

    const times = parseStartTimes(startTimes)
    if (times.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกวันและเวลาอย่างน้อย 1 ช่วง' }, { status: 400 })
    }
    const invalidTime = times.find((t) => !COACH_SLOT_TIMES.includes(t as (typeof COACH_SLOT_TIMES)[number]))
    if (invalidTime) {
      return NextResponse.json({ error: `ช่วงเวลา ${invalidTime} ไม่เปิดให้จอง` }, { status: 400 })
    }
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate))) {
      return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 })
    }
    if (!courtId) {
      return NextResponse.json({ error: 'กรุณาเลือกสนามที่ต้องการใช้สอน' }, { status: 400 })
    }
    if (!String(playerName ?? '').trim() || !String(playerPhone ?? '').trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อและเบอร์โทรผู้จอง' }, { status: 400 })
    }

    // สลิปการชำระเงิน — บังคับ เพราะเป็นขั้น "จ่ายเงินจริง"
    if (typeof slipDataUrl !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(slipDataUrl)) {
      return NextResponse.json(
        { error: 'ไฟล์สลิปไม่ถูกต้อง — รองรับเฉพาะ .jpg หรือ .png' },
        { status: 400 }
      )
    }
    if (dataUrlBytes(slipDataUrl) > MAX_SLIP_BYTES) {
      return NextResponse.json({ error: 'ไฟล์สลิปใหญ่เกินไป (สูงสุด 300kB)' }, { status: 400 })
    }

    // จองล่วงหน้าได้ไม่เกิน 42 วัน (ตรวจฝั่ง server เพื่อความปลอดภัย)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const maxDateStr = format(addDays(new Date(), MAX_ADVANCE_DAYS), 'yyyy-MM-dd')
    if (String(bookingDate) < todayStr || String(bookingDate) > maxDateStr) {
      return NextResponse.json(
        {
          error: `จองได้ตั้งแต่วันนี้ ถึง ${format(addDays(new Date(), MAX_ADVANCE_DAYS), 'd MMM yy', { locale: th })} (ล่วงหน้า ${MAX_ADVANCE_DAYS} วัน)`,
        },
        { status: 400 }
      )
    }

    // ไม่ให้จองช่วงเวลาที่ปิดรับจองแล้ว (เลย startTime + เวลาผ่อนผันของวันนี้)
    const passedTime = times.find((t) => isSlotPassed(String(bookingDate), t))
    if (passedTime) {
      return NextResponse.json(
        { error: `ช่วงเวลา ${passedTime} ปิดรับจองแล้ว — รับจองถึง ${SLOT_GRACE_MINUTES} นาทีหลังเริ่มเวลา` },
        { status: 400 }
      )
    }

    const court = await db.court.findUnique({ where: { id: String(courtId) } })
    if (!court || !court.isActive) {
      return NextResponse.json({ error: 'สนามไม่ถูกต้อง หรือถูกปิดใช้งาน' }, { status: 400 })
    }

    // ช่วงเวลาในตาราง TimeSlot ของวันนั้น (ใช้ id จริง → กันชนกับกริดจองสนามได้ตรงกัน)
    const dayOfWeek = new Date(`${bookingDate}T00:00:00`).getDay()
    const slots = await db.timeSlot.findMany({
      where: { dayOfWeek, isActive: true, startTime: { in: times } },
    })
    const slotByStart = new Map(slots.map((s) => [s.startTime, s]))
    const missing = times.filter((t) => !slotByStart.has(t))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `ช่วงเวลา ${missing.join(', ')} ไม่เปิดให้จองในวันนี้` },
        { status: 400 }
      )
    }

    // สนามว่างไหม — เทียบกับการจองสนามทั้งหมด (กริดจองสนาม / POS / เคาน์เตอร์)
    const courtRows = await db.booking.findMany({
      where: {
        courtId: court.id,
        bookingDate: String(bookingDate),
        timeSlotId: { in: slots.map((s) => s.id) },
      },
    })
    const takenRow = courtRows.find((r) => r.status !== 'cancelled')
    if (takenRow) {
      const takenSlot = slots.find((s) => s.id === takenRow.timeSlotId)
      return NextResponse.json(
        { error: `สนามนี้ถูกจองแล้วในช่วง ${takenSlot?.startTime ?? ''} — กรุณาเลือกช่วงเวลาอื่น` },
        { status: 409 }
      )
    }

    // โค้ชคนนี้ว่างไหม — เช็คการจองโค้ชเดิมที่ยังไม่ถูกยกเลิก
    const coachRows = await db.coachBooking.findMany({
      where: { coachId: coach.id, bookingDate: String(bookingDate), status: { in: ACTIVE_STATUSES } },
    })
    const clash = coachRows.find((r) => parseStartTimes(r.startTimes).some((t) => times.includes(t)))
    if (clash) {
      return NextResponse.json(
        {
          error: `${coach.name} มีคิวในช่วงเวลาที่เลือกแล้ว (รหัส ${clash.ticketCode ?? clash.id}) — กรุณาเลือกช่วงเวลาอื่น`,
        },
        { status: 409 }
      )
    }

    // ราคา: ค่าสนาม (ตาม PriceRule ของวันนั้น) + ค่าโค้ช (ราคา/ชม. × จำนวนชั่วโมง)
    const rules = await db.priceRule.findMany()
    const courtTotal = times.reduce((sum, t) => sum + getSlotPrice(court.pricePerHour, dayOfWeek, t, rules), 0)
    const coachTotal = coach.pricePerHour * times.length
    const totalPrice = courtTotal + coachTotal

    const noteText = String(note ?? '').trim()
    const basePlayer = {
      playerName: String(playerName).trim(),
      playerPhone: String(playerPhone).trim(),
      playerEmail: playerEmail ? String(playerEmail) : null,
      slipName: slipName ? String(slipName) : null,
      slipDataUrl,
      status: 'pending', // รอเจ้าหน้าที่ตรวจสอบการชำระเงิน
    }

    // 1) สร้างแถว Booking ของสนามทีละชั่วโมง → สนามถูกกันจริงในกริดจองสนาม
    const courtBookingIds: string[] = []
    for (const t of times) {
      const slot = slotByStart.get(t)
      if (!slot) continue
      const payload = {
        courtId: court.id,
        timeSlotId: slot.id,
        bookingDate: String(bookingDate),
        note: `จองพร้อมโค้ช ${coach.name}${noteText ? ` — ${noteText}` : ''}`,
        ...basePlayer,
      }
      const reusable = courtRows.find((r) => r.timeSlotId === slot.id)
      const row = reusable
        ? await db.booking.update({ where: { id: reusable.id }, data: payload })
        : await db.booking.create({ data: payload })
      if (!reusable) createdCourtRowIds.push(row.id)
      courtBookingIds.push(row.id)
    }

    // 2) สร้าง CoachBooking (ยอดรวม = ค่าสนาม + ค่าโค้ช) พร้อม snapshot ราคา
    const coachBooking = await createCoachBookingWithUniqueCode({
      coachId: coach.id,
      coachName: coach.name,
      coachPrice: coach.pricePerHour,
      courtId: court.id,
      courtName: court.name,
      bookingDate: String(bookingDate),
      startTimes: times.join(','),
      hours: times.length,
      courtTotal,
      coachTotal,
      totalPrice,
      courtBookingIds: JSON.stringify(courtBookingIds),
      note: noteText || null,
      ...basePlayer,
    })

    return NextResponse.json(coachBooking)
  } catch (error) {
    // ล้มกลางทาง → คืนสนามที่เพิ่งกันไว้ เพื่อไม่ให้สนามค้างถูกจองโดยไม่มีเจ้าของ
    if (createdCourtRowIds.length > 0) {
      await db.booking.deleteMany({ where: { id: { in: createdCourtRowIds } } }).catch(() => {})
    }
    console.error('Error creating coach booking:', error)
    return NextResponse.json({ error: 'Failed to create coach booking' }, { status: 500 })
  }
}

/**
 * PUT /api/coach-bookings — อัปเดตการจองโค้ช (แอดมิน: ยืนยันการชำระ / แนบ–ลบสลิป)
 * ส่ง status มา → แถว Booking (สนาม) ที่ผูกไว้ถูกอัปเดตให้ตรงกันด้วย
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, slipDataUrl, slipName, clearSlip } = body ?? {}
    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })

    const existing = await db.coachBooking.findUnique({ where: { id: String(id) } })
    if (!existing) return NextResponse.json({ error: 'ไม่พบการจองโค้ช' }, { status: 404 })

    const data: Prisma.CoachBookingUncheckedUpdateInput = {}
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(String(status))) {
        return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 })
      }
      data.status = String(status)
    }
    if (clearSlip) {
      data.slipDataUrl = null
      data.slipName = null
    } else if (slipDataUrl !== undefined) {
      if (typeof slipDataUrl !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(slipDataUrl)) {
        return NextResponse.json(
          { error: 'ไฟล์สลิปไม่ถูกต้อง — รองรับเฉพาะ .jpg หรือ .png' },
          { status: 400 }
        )
      }
      if (dataUrlBytes(slipDataUrl) > MAX_SLIP_BYTES) {
        return NextResponse.json({ error: 'ไฟล์สลิปใหญ่เกินไป (สูงสุด 300kB)' }, { status: 400 })
      }
      data.slipDataUrl = slipDataUrl
      data.slipName = slipName ? String(slipName) : existing.slipName ?? null
    }

    const updated = await db.coachBooking.update({ where: { id: existing.id }, data })

    // ให้สถานะของแถวสนาม (Booking) ตรงกับสถานะการจองโค้ช — ยกเลิก = ปล่อยสนามคืน
    if (status !== undefined) {
      const courtIds = parseCourtBookingIds(existing.courtBookingIds)
      if (courtIds.length > 0) {
        await db.booking.updateMany({ where: { id: { in: courtIds } }, data: { status: String(status) } })
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating coach booking:', error)
    return NextResponse.json({ error: 'Failed to update coach booking' }, { status: 500 })
  }
}

/** DELETE /api/coach-bookings?id=... — ยกเลิกการจองโค้ช (soft cancel) + ปล่อยสนามที่กันไว้คืน */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })

    const existing = await db.coachBooking.findUnique({ where: { id: String(id) } })
    if (!existing) return NextResponse.json({ error: 'ไม่พบการจองโค้ช' }, { status: 404 })

    await db.coachBooking.update({ where: { id: existing.id }, data: { status: 'cancelled' } })

    const courtIds = parseCourtBookingIds(existing.courtBookingIds)
    if (courtIds.length > 0) {
      await db.booking.updateMany({ where: { id: { in: courtIds } }, data: { status: 'cancelled' } })
    }
    return NextResponse.json({ message: 'Coach booking cancelled' })
  } catch (error) {
    console.error('Error cancelling coach booking:', error)
    return NextResponse.json({ error: 'Failed to cancel coach booking' }, { status: 500 })
  }
}
