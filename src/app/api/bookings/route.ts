import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { generateTicketCode } from '@/lib/ticket-code'
import { format, addDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { sendTicketPush } from '@/lib/line-messaging'

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
    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courtId, timeSlotId, bookingDate, playerName, playerPhone, playerEmail, note, userId, racketCount, slipName, slipDataUrl } = body

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

    const existing = await db.booking.findFirst({
      where: {
        courtId,
        timeSlotId,
        bookingDate,
        status: { in: ['pending', 'confirmed'] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น' },
        { status: 409 }
      )
    }

    const booking = await createBookingWithUniqueCode({
      courtId,
      timeSlotId,
      bookingDate,
      playerName,
      playerPhone,
      playerEmail: playerEmail || null,
      note: note || null,
      userId: userId || null,
      racketCount: racketCount || 0,
      slipName: slipName || null,
      slipDataUrl: slipDataUrl || null,
      status: 'confirmed',
    })

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

    // 🔔 Push ticket เข้าแชท LINE (ผู้ใช้ที่ login ด้วย LINE + เป็นเพื่อน OA) — fire-and-forget ไม่ล้มการจอง
    void sendTicketPush(booking.id)

    return NextResponse.json(booking, { status: 201 })
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
