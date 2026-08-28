import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lineUserId = searchParams.get('lineUserId')
    const playerPhone = searchParams.get('playerPhone')
    const ticketCode = searchParams.get('ticketCode')

    if (!lineUserId && !playerPhone && !ticketCode) {
      return NextResponse.json(
        { error: 'กรุณาระบุ lineUserId, playerPhone หรือ ticketCode' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (lineUserId) {
      const user = await db.user.findUnique({ where: { lineUserId } })
      if (user) {
        where.userId = user.id
      } else {
        return NextResponse.json([])
      }
    }
    if (playerPhone) {
      where.playerPhone = playerPhone
    }
    if (ticketCode) {
      // รหัสตั๋วเก็บเป็นตัวพิมพ์ใหญ่เสมอ — แปลงให้ค้นได้ทั้งพิมพ์เล็ก/พิมพ์ใหญ่
      where.ticketCode = ticketCode.trim().toUpperCase()
    }

    const bookings = await db.booking.findMany({
      where,
      include: {
        court: true,
        timeSlot: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching my bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
