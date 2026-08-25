import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dayOfWeek = searchParams.get('dayOfWeek')
    const date = searchParams.get('date')

    let targetDayOfWeek = dayOfWeek ? parseInt(dayOfWeek) : null

    if (!targetDayOfWeek && date) {
      const d = new Date(date + 'T00:00:00')
      targetDayOfWeek = d.getDay()
    }

    const slots = await db.timeSlot.findMany({
      where: {
        isActive: true,
        ...(targetDayOfWeek !== null ? { dayOfWeek: targetDayOfWeek } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(slots)
  } catch (error) {
    console.error('Error fetching time slots:', error)
    return NextResponse.json({ error: 'Failed to fetch time slots' }, { status: 500 })
  }
}
