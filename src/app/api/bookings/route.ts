import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { sanitizeSlipVerify } from '@/lib/slip-verify'
import { generateTicketCode } from '@/lib/ticket-code'
import { format, addDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { sendTicketPush } from '@/lib/line-messaging'
import { SLOT_GRACE_MINUTES, isSlotPassed } from '@/lib/slot-time'
import { getSlotPrice } from '@/lib/price'
import { COACH_PACKAGES } from '@/components/activity/coaches'
import { attachCoachToBookings } from '@/lib/coach-ticket'

/** สถานะที่ยังกันคิวอยู่ (ใช้เช็คคิวโค้ชทับกับลูกค้ารายอื่น) */
const COACH_ACTIVE_STATUSES = ['pending', 'confirmed']

/** เวลาเริ่มของแต่ละชั่วโมงที่เก็บใน CoachBooking — รูปแบบ "09:00,10:00" */
function parseStartTimes(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t))
}

/** จำนวนชั่วโมงของสล็อต (endTime - startTime) — ใช้คิดค่าโค้ชต่อชั่วโมง */
function slotHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

/** id ของ Booking (สนาม) ที่ผูกกับ CoachBooking — เก็บเป็น JSON array */
function parseCourtBookingIds(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** สร้าง CoachBooking โดยพยายาม ticketCode ที่ไม่ซ้ำ (retry เมื่อชนกัน) */
async function createCoachBookingWithUniqueCode(data: Prisma.CoachBookingUncheckedCreateInput) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await db.coachBooking.create({
        data: { ...data, ticketCode: generateTicketCode() },
      })
    } catch (error) {
      const e = error as { code?: string }
      if (e.code === 'P2002') continue // ticketCode ชนกัน → ลองใหม่
      throw error
    }
  }
  throw new Error('ไม่สามารถสร้างรหัสตั๋วโค้ชที่ไม่ซ้ำได้')
}

/** สร้าง booking โดยพยายาม ticketCode ที่ไม่ซ้ำ (retry เมื่อชนกัน) */
async function createBookingWithUniqueCode(data: Prisma.BookingUncheckedCreateInput) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await db.booking.create({
        data: { ...data, ticketCode: generateTicketCode() },
        include: { court: true, timeSlot: true },
      })
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
    const courtId = searchParams.get('courtId')

    const where: Record<string, unknown> = {}
    if (date) where.bookingDate = date
    if (courtId) where.courtId = courtId

    const bookings = await db.booking.findMany({
      where,
      include: {
        court: true,
        timeSlot: true,
        user: {
          select: { name: true, lineDisplayName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    // แนบข้อมูลโค้ช (ชื่อ + จำนวนชั่วโมง) เพื่อให้ตั๋วแสดงรายละเอียดโค้ชได้
    return NextResponse.json(await attachCoachToBookings(bookings))
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

/** แปลงผลตรวจสลิป (จาก client) → ฟิลด์ที่บันทึกลง DB — ใช้ตัวช่วยกลางจาก lib/slip-verify */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courtId, timeSlotId, bookingDate, playerName, playerPhone, playerEmail, note, userId, racketCount, slipName, slipDataUrl, status, coachId, coachBookingId, coachStartTimes, verify } = body

    if (!courtId || !timeSlotId || !bookingDate || !playerName || !playerPhone) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    // เปิดจองล่วงหน้าได้ไม่เกิน 42 วัน (ตรวจฝั่ง server เพื่อความปลอดภัย)
    const MAX_ADVANCE_DAYS = 42
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const maxDateStr = format(addDays(new Date(), MAX_ADVANCE_DAYS), 'yyyy-MM-dd')
    if (bookingDate < todayStr || bookingDate > maxDateStr) {
      return NextResponse.json(
        { error: `จองได้ตั้งแต่วันนี้ ถึง ${format(addDays(new Date(), MAX_ADVANCE_DAYS), 'd MMM yy', { locale: th })} (ล่วงหน้า ${MAX_ADVANCE_DAYS} วัน)` },
        { status: 400 }
      )
    }

    // ไม่ให้จองช่วงเวลาที่ปิดรับจองแล้ว (เลย startTime + SLOT_GRACE_MINUTES ของวันนี้)
    const slot = await db.timeSlot.findUnique({ where: { id: String(timeSlotId) } })
    if (!slot) {
      return NextResponse.json(
        { error: 'ช่วงเวลาไม่ถูกต้อง' },
        { status: 400 }
      )
    }
    if (isSlotPassed(bookingDate, slot.startTime)) {
      return NextResponse.json(
        { error: `ช่วงเวลานี้ปิดรับจองแล้ว — รับจองถึง ${SLOT_GRACE_MINUTES} นาทีหลังเริ่มเวลา` },
        { status: 400 }
      )
    }

    // จองพร้อมโค้ช (ส่ง coachId มาจากหน้า /activity/coach) — คิดเงินรวม + ผูกแถวสนามกับ CoachBooking
    const coach = coachId ? COACH_PACKAGES.find((c) => c.id === String(coachId)) : undefined
    if (coachId && !coach) {
      return NextResponse.json({ error: 'ไม่พบแพ็กเกจโค้ชที่เลือก' }, { status: 400 })
    }

    /**
     * ช่องเวลาที่ติ๊กให้โค้ชดูแล (ส่งมาจากขั้นสรุปการจอง)
     *  - ส่ง coachStartTimes มา → บันทึกคิวโค้ช/คิดค่าโค้ช "เฉพาะช่องที่ติ๊ก"
     *  - ไม่ส่งมา (เช่น จองจากหน้า /activity/coach) → ดูแลทุกช่วงของสล็อตเหมือนเดิม
     */
    const hasTickedCoachTimes = Array.isArray(coachStartTimes)
    const tickedCoachStartTimes = hasTickedCoachTimes
      ? [...new Set((coachStartTimes as unknown[]).map((t) => String(t).trim()).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort()
      : []
    /** รอบนี้ต้องบันทึกคิวโค้ชจริงไหม — โหมดติ๊กเลือก: เฉพาะช่องที่ติ๊กเท่านั้น */
    const coachNeeded = !!coach && (!hasTickedCoachTimes || tickedCoachStartTimes.includes(slot.startTime))

    // โค้ชคนนี้มีคิวทับช่วงเวลานี้หรือยัง (แถวสนามเดิมที่ยกเลิกไปแล้วไม่นับ)
    if (coach && coachNeeded) {
      const coachRows = await db.coachBooking.findMany({
        where: { coachId: coach.id, bookingDate, status: { in: COACH_ACTIVE_STATUSES } },
      })
      const clash = coachRows.find(
        (r) => r.id !== String(coachBookingId ?? '') && parseStartTimes(r.startTimes).includes(slot.startTime)
      )
      if (clash) {
        return NextResponse.json(
          { error: `${coach.name} มีคิวในช่วงเวลานี้แล้ว (รหัส ${clash.ticketCode ?? clash.id}) — กรุณาเลือกช่วงเวลาอื่น` },
          { status: 409 }
        )
      }
    }

    // ช่องนี้ (court + slot + วันที่) มี booking ค้างอยู่ไหม — unique constraint กันไว้แค่ 1 แถว
    const existing = await db.booking.findFirst({
      where: { courtId, timeSlotId, bookingDate },
    })

    if (existing && existing.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น' },
        { status: 409 }
      )
    }

    // หมายเหตุ: จองพร้อมโค้ช → ขึ้นต้นด้วยชื่อโค้ช ให้หลังบ้านเห็นว่าเป็นการจองคู่กับโค้ช
    const noteText = String(note ?? '').trim()
    const finalNote = coach
      ? [`จองพร้อมโค้ช ${coach.name}`, noteText].filter(Boolean).join(' — ')
      : noteText || null

    // สถานะเริ่มต้น 'confirmed' (ชำระแล้ว) — POS หน้าเคาน์เตอร์ส่ง 'pending' มาได้เมื่อลูกค้ายังไม่จ่าย
    const initialStatus = status === 'pending' ? 'pending' : 'confirmed'
    // ผลตรวจสลิป (Slip2Go) ส่งมาจากหน้าจอง — บันทึกไว้ตามรอย
    const verifyData = sanitizeSlipVerify(verify)

    let booking
    if (existing) {
      // ช่องเดิมเคยถูกยกเลิก → เปิดจองซ้ำด้วย record เดิม
      // (unique [courtId, timeSlotId, bookingDate] เก็บได้แค่ 1 แถวต่อช่อง)
      booking = await db.booking.update({
        where: { id: existing.id },
        data: {
          playerName,
          playerPhone,
          playerEmail: playerEmail || null,
          note: finalNote,
          userId: userId || null,
          racketCount: racketCount || 0,
          slipName: slipName || null,
          slipDataUrl: slipDataUrl || null,
          status: initialStatus,
          ticketCode: generateTicketCode(),
          ...verifyData,
        },
        include: { court: true, timeSlot: true },
      })
    } else {
      booking = await createBookingWithUniqueCode({
        courtId,
        timeSlotId,
        bookingDate,
        playerName,
        playerPhone,
        playerEmail: playerEmail || null,
        note: finalNote,
        userId: userId || null,
        racketCount: racketCount || 0,
        slipName: slipName || null,
        slipDataUrl: slipDataUrl || null,
        status: initialStatus,
        ...verifyData,
      })
    }

    // บันทึกข้อมูลผู้จอง (ชื่อ/เบอร์/อีเมล) ลง User เพื่อ auto-fill ครั้งถัดไปสำหรับ LINE ID เดิม
    if (userId) {
      await db.user
        .update({
          where: { id: userId },
          data: {
            name: playerName,
            phone: playerPhone,
            email: playerEmail || undefined,
          },
        })
        .catch(() => {})
    }

    // 🎾 จองพร้อมโค้ช — บันทึก CoachBooking (ยอดรวม = ค่าสนาม + ค่าโค้ช) แล้วผูกกับแถวสนามที่เพิ่งสร้าง
    //    ส่งหลายช่วงเวลา → client ส่ง coachBookingId กลับมาเพื่อต่อท้ายแถวเดิมของรอบเดียวกัน
    let coachBookingOutId: string | null = null
    let coachBookingError = false
    if (coach && coachNeeded) {
      try {
        const rules = await db.priceRule.findMany()
        const dayOfWeek = new Date(`${bookingDate}T00:00:00`).getDay()
        const hours = slotHours(booking.timeSlot.startTime, booking.timeSlot.endTime)
        const slotPrice = getSlotPrice(booking.court.pricePerHour, dayOfWeek, booking.timeSlot.startTime, rules)
        // ชั่วโมงโค้ช = ช่องที่ติ๊ก (โหมดติ๊กเลือก) หรือทุกช่วงของสล็อต (โหมด /activity/coach)
        const coachHours = hasTickedCoachTimes ? tickedCoachStartTimes.length : hours
        /** เวลาเริ่มของแต่ละชั่วโมงที่โค้ชดูแล — รูปแบบ "09:00,10:00" */
        const coachStartTimesValue = hasTickedCoachTimes ? tickedCoachStartTimes.join(',') : booking.timeSlot.startTime
        const coachTotalThisSlot = coach.pricePerHour * coachHours

        const target = coachBookingId
          ? await db.coachBooking.findUnique({ where: { id: String(coachBookingId) } })
          : null
        const canExtend =
          !!target &&
          target.status !== 'cancelled' &&
          target.coachId === coach.id &&
          target.courtId === booking.courtId &&
          target.bookingDate === bookingDate

        if (target && canExtend) {
          coachBookingOutId = target.id
          const courtBookingIds = parseCourtBookingIds(target.courtBookingIds)
          // ช่วงเวลานี้เคยถูกนับไปแล้ว (เช่น กดยืนยันซ้ำ) → อัปเดตแค่สลิป ไม่บวกยอดซ้ำ
          if (!courtBookingIds.includes(booking.id)) {
            await db.coachBooking.update({
              where: { id: target.id },
              data: {
                // เขียนทับด้วยชุดช่องที่ติ๊กทั้งหมดของรายการนี้ (กดยืนยันซ้ำได้ค่าเดิม ไม่บวกซ้ำ)
                startTimes: coachStartTimesValue,
                hours: coachHours,
                courtTotal: target.courtTotal + slotPrice,
                coachTotal: coachTotalThisSlot,
                totalPrice: target.courtTotal + slotPrice + coachTotalThisSlot,
                courtBookingIds: JSON.stringify([...courtBookingIds, booking.id]),
                slipName: slipName || target.slipName,
                slipDataUrl: slipDataUrl || target.slipDataUrl,
              },
            })
          }
        } else {
          const row = await createCoachBookingWithUniqueCode({
            coachId: coach.id,
            coachName: coach.name,
            coachPrice: coach.pricePerHour,
            courtId: booking.courtId,
            courtName: booking.court.name,
            bookingDate,
            startTimes: coachStartTimesValue,
            hours: coachHours,
            courtTotal: slotPrice,
            coachTotal: coachTotalThisSlot,
            totalPrice: slotPrice + coachTotalThisSlot,
            courtBookingIds: JSON.stringify([booking.id]),
            playerName,
            playerPhone,
            playerEmail: playerEmail || null,
            note: noteText || null,
            slipName: slipName || null,
            slipDataUrl: slipDataUrl || null,
            status: initialStatus,
          })
          coachBookingOutId = row.id
        }
      } catch (error) {
        // จองสนามสำเร็จแล้ว — บันทึกคิวโค้ชล้มไม่ควรทำให้ทั้งคำขอล้ม (client แจ้งเตือนให้ตรวจสอบ)
        coachBookingError = true
        console.error('Error creating coach booking:', error)
      }
    }

    // 🔔 Push ticket เข้าแชท LINE (ผู้ใช้ที่ login ด้วย LINE + เป็นเพื่อน OA) — fire-and-forget ไม่ล้มการจอง
    void sendTicketPush(booking.id)

    return NextResponse.json({ ...booking, coachBookingId: coachBookingOutId, coachBookingError }, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      courtId,
      timeSlotId,
      bookingDate,
      playerName,
      playerPhone,
      playerEmail,
      note,
      status,
      racketCount,
      slipName,
      slipDataUrl,
      clearSlip,
    } = body

    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })

    const existing = await db.booking.findUnique({ where: { id: String(id) } })
    if (!existing) return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (courtId !== undefined) data.courtId = courtId
    if (timeSlotId !== undefined) data.timeSlotId = timeSlotId
    if (bookingDate !== undefined) data.bookingDate = bookingDate
    if (playerName !== undefined) data.playerName = playerName
    if (playerPhone !== undefined) data.playerPhone = playerPhone
    if (playerEmail !== undefined) data.playerEmail = playerEmail || null
    if (note !== undefined) data.note = note || null
    if (status !== undefined) data.status = status
    if (racketCount !== undefined) data.racketCount = Number(racketCount) || 0
    // สลิปการชำระเงิน (แอดมินอัปโหลด/ลบ แทนลูกค้าได้จาก Dashboard → Slip Upload)
    if (clearSlip) {
      data.slipDataUrl = null
      data.slipName = null
    } else if (slipDataUrl !== undefined) {
      data.slipDataUrl = slipDataUrl || null
      data.slipName = slipName || existing.slipName || null
    }

    // If slot/court/date changed, ensure the target slot isn't already booked by someone else.
    const newCourtId = courtId ?? existing.courtId
    const newTimeSlotId = timeSlotId ?? existing.timeSlotId
    const newDate = bookingDate ?? existing.bookingDate
    if (courtId !== undefined || timeSlotId !== undefined || bookingDate !== undefined) {
      const conflict = await db.booking.findFirst({
        where: {
          courtId: newCourtId,
          timeSlotId: newTimeSlotId,
          bookingDate: newDate,
          status: { in: ['pending', 'confirmed'] },
          NOT: { id: String(id) },
        },
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น' },
          { status: 409 }
        )
      }

      // ปลายทางมีแถว "ยกเลิก" ค้างอยู่ → ลบทิ้งก่อนย้าย
      // (unique [courtId, timeSlotId, bookingDate] เก็บได้แค่ 1 แถวต่อช่อง แม้เป็นแถวยกเลิก)
      const cancelledTarget = await db.booking.findFirst({
        where: {
          courtId: newCourtId,
          timeSlotId: newTimeSlotId,
          bookingDate: newDate,
          status: 'cancelled',
          NOT: { id: String(id) },
        },
      })
      if (cancelledTarget) {
        await db.booking.delete({ where: { id: cancelledTarget.id } })
      }

      // ไม่ให้ย้ายไปวัน/เวลาที่ปิดรับจองแล้ว (แก้ไขข้อมูลอื่นของ booking เดิมที่เป็นอดีตยังทำได้ปกติ)
      const dateChanged = bookingDate !== undefined && bookingDate !== existing.bookingDate
      const slotChanged = timeSlotId !== undefined && timeSlotId !== existing.timeSlotId
      if (dateChanged || slotChanged) {
        const targetSlot = await db.timeSlot.findUnique({ where: { id: String(newTimeSlotId) } })
        const targetPassed = !!targetSlot && isSlotPassed(newDate, targetSlot.startTime)
        if (targetPassed) {
          return NextResponse.json(
            { error: `ไม่สามารถย้ายไปช่วงเวลาที่ปิดรับจองแล้วได้ — รับจองถึง ${SLOT_GRACE_MINUTES} นาทีหลังเริ่มเวลา` },
            { status: 400 }
          )
        }
      }
    }

    const booking = await db.booking.update({
      where: { id: String(id) },
      data,
      include: { court: true, timeSlot: true, user: { select: { name: true, lineDisplayName: true, phone: true } } },
    })
    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })

    // Soft cancel: set status = cancelled (keeps history)
    await db.booking.update({ where: { id: String(id) }, data: { status: 'cancelled' } })
    return NextResponse.json({ message: 'Booking cancelled' })
  } catch (error) {
    console.error('Error cancelling booking:', error)
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }
}
