import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lineUserId = searchParams.get('lineUserId')
    const playerPhone = searchParams.get('playerPhone')

    if (!lineUserId && !playerPhone) {
      return NextResponse.json(
        { error: 'กรุณาระบุ lineUserId หรือ playerPhone' },
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
    } else if (playerPhone) {
      where.playerPhone = playerPhone
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
