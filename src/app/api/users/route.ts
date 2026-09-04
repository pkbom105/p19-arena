import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/** GET — รายชื่อสมาชิกที่เข้าสู่ระบบด้วย LINE (มี lineUserId) เรียงจากคนล่าสุด */
export async function GET() {
  try {
    const users = await db.user.findMany({
      where: { lineUserId: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { bookings: true } } },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
