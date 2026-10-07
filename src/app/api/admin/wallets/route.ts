import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const users = await db.user.findMany({
      where: { lineUserId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lineUserId: true,
        lineDisplayName: true,
        linePictureUrl: true,
        name: true,
        phone: true,
        email: true,
        walletBalance: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('Failed to load admin wallet balances', error)
    return NextResponse.json({ error: 'Failed to load wallet balances' }, { status: 500 })
  }
}
