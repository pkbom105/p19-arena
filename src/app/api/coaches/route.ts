import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { ensureCoaches } from '@/lib/coaches'

/** GET /api/coaches — ปกติ = เฉพาะที่เปิดใช้งาน · ?all=1 = รวมที่ปิดใช้งาน */
export async function GET(request: NextRequest) {
  try {
    await ensureCoaches()
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'
    const items = await db.coach.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching coaches:', error)
    return NextResponse.json({ error: 'Failed to fetch coaches' }, { status: 500 })
  }
}

/** POST /api/coaches — เพิ่มโค้ชใหม่ */
export async function POST(request: NextRequest) {
  try {
    await ensureCoaches()
    const body = await request.json()
    const { name, initial, level, pricePerHour, experienceYears, specialties, availableDays, rating, sortOrder } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อโค้ช' }, { status: 400 })
    }

    const item = await db.coach.create({
      data: {
        name: name.trim(),
        initial: initial?.trim() || 'ค',
        level: level?.trim() || '',
        pricePerHour: Number(pricePerHour) || 0,
        experienceYears: Number(experienceYears) || 0,
        specialties: Array.isArray(specialties) ? specialties.join(',') : String(specialties ?? '').trim(),
        availableDays: String(availableDays ?? '').trim(),
        rating: Number(rating) || 0,
        sortOrder: Number(sortOrder) || 0,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating coach:', error)
    return NextResponse.json({ error: 'Failed to create coach' }, { status: 500 })
  }
}

/** PUT /api/coaches — แก้ไขโค้ช (ส่งเฉพาะฟิลด์ที่แก้ก็ได้) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, initial, level, pricePerHour, experienceYears, specialties, availableDays, rating, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Coach ID is required' }, { status: 400 })
    }

    const item = await db.coach.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(initial !== undefined ? { initial: String(initial).trim() || '' } : {}),
        ...(level !== undefined ? { level: String(level).trim() || '' } : {}),
        ...(pricePerHour !== undefined ? { pricePerHour: Number(pricePerHour) || 0 } : {}),
        ...(experienceYears !== undefined ? { experienceYears: Number(experienceYears) || 0 } : {}),
        ...(specialties !== undefined ? { specialties: Array.isArray(specialties) ? specialties.join(',') : String(specialties).trim() } : {}),
        ...(availableDays !== undefined ? { availableDays: String(availableDays).trim() || '' } : {}),
        ...(rating !== undefined ? { rating: Number(rating) || 0 } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) || 0 } : {}),
        ...(isActive !== undefined ? { isActive: isActive === true } : {}),
      },
    })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating coach:', error)
    return NextResponse.json({ error: 'Failed to update coach' }, { status: 500 })
  }
}

/** DELETE /api/coaches?id=... — ปิดใช้งาน (soft) · ?hard=1 = ลบถาวร */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const hard = searchParams.get('hard') === '1'

    if (!id) {
      return NextResponse.json({ error: 'Coach ID is required' }, { status: 400 })
    }

    if (hard) {
      await db.coach.delete({ where: { id } })
      return NextResponse.json({ message: 'Coach deleted permanently' })
    }
    await db.coach.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ message: 'Coach deactivated' })
  } catch (error) {
    console.error('Error deleting coach:', error)
    return NextResponse.json({ error: 'Failed to delete coach' }, { status: 500 })
  }
}
