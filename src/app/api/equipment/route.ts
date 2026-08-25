import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const items = await db.rentalEquipment.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, nameEn, pricePerUnit, sortOrder, isActive } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่ออุปกรณ์' }, { status: 400 })
    }

    const item = await db.rentalEquipment.create({
      data: {
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        pricePerUnit: pricePerUnit ?? 0,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating equipment:', error)
    return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, nameEn, pricePerUnit, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Equipment ID is required' }, { status: 400 })
    }

    const item = await db.rentalEquipment.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(nameEn !== undefined ? { nameEn: nameEn?.trim() || null } : {}),
        ...(pricePerUnit !== undefined ? { pricePerUnit } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating equipment:', error)
    return NextResponse.json({ error: 'Failed to update equipment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Equipment ID is required' }, { status: 400 })
    }

    await db.rentalEquipment.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ message: 'Equipment deactivated' })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json({ error: 'Failed to delete equipment' }, { status: 500 })
  }
}
