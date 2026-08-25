import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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
    const { courtId, timeSlotId, bookingDate, playerName, playerPhone, playerEmail, note, userId, racketCount } = body

    if (!courtId || !timeSlotId || !bookingDate || !playerName || !playerPhone) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
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

    const booking = await db.booking.create({
      data: {
        courtId,
        timeSlotId,
        bookingDate,
        playerName,
        playerPhone,
        playerEmail: playerEmail || null,
        note: note || null,
        userId: userId || null,
        racketCount: racketCount || 0,
        status: 'confirmed',
      },
      include: {
        court: true,
        timeSlot: true,
      },
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
