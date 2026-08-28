import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dayOfWeek = searchParams.get('dayOfWeek')
    const date = searchParams.get('date')
    const all = searchParams.get('all')

    let targetDayOfWeek = dayOfWeek ? parseInt(dayOfWeek) : null

    if (!targetDayOfWeek && date) {
      const d = new Date(date + 'T00:00:00')
      targetDayOfWeek = d.getDay()
    }

    const slots = await db.timeSlot.findMany({
      where: {
        ...(all !== '1' ? { isActive: true } : {}),
        ...(targetDayOfWeek !== null ? { dayOfWeek: targetDayOfWeek } : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }, { startTime: 'asc' }],
    })
    return NextResponse.json(slots)
  } catch (error) {
    console.error('Error fetching time slots:', error)
    return NextResponse.json({ error: 'Failed to fetch time slots' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startTime, endTime, dayOfWeek, sortOrder, isActive } = body

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'กรุณากรอกเวลาเริ่มและสิ้นสุด' }, { status: 400 })
    }
    if ([0, 1, 2, 3, 4, 5, 6].indexOf(Number(dayOfWeek)) === -1) {
      return NextResponse.json({ error: 'วันไม่ถูกต้อง' }, { status: 400 })
    }

    const slot = await db.timeSlot.create({
      data: {
        startTime: String(startTime),
        endTime: String(endTime),
        dayOfWeek: Number(dayOfWeek),
        sortOrder: sortOrder === undefined ? 0 : Number(sortOrder) || 0,
        isActive: isActive ?? true,
      },
    })
    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    console.error('Error creating time slot:', error)
    return NextResponse.json({ error: 'Failed to create time slot' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, startTime, endTime, dayOfWeek, sortOrder, isActive } = body

    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })
    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'กรุณากรอกเวลาเริ่มและสิ้นสุด' }, { status: 400 })
    }

    const slot = await db.timeSlot.update({
      where: { id: String(id) },
      data: {
        ...(startTime !== undefined ? { startTime: String(startTime) } : {}),
        ...(endTime !== undefined ? { endTime: String(endTime) } : {}),
        ...(dayOfWeek !== undefined ? { dayOfWeek: Number(dayOfWeek) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) || 0 } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    })
    return NextResponse.json(slot)
  } catch (error) {
    console.error('Error updating time slot:', error)
    return NextResponse.json({ error: 'Failed to update time slot' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })

    // Soft delete: set isActive = false (keeps booking history / FK constraints safe)
    await db.timeSlot.update({ where: { id: String(id) }, data: { isActive: false } })
    return NextResponse.json({ message: 'Time slot deactivated' })
  } catch (error) {
    console.error('Error deleting time slot:', error)
    return NextResponse.json({ error: 'Failed to delete time slot' }, { status: 500 })
  }
}
