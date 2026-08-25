import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const courts = await db.court.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(courts)
  } catch (error) {
    console.error('Error fetching courts:', error)
    return NextResponse.json({ error: 'Failed to fetch courts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, pricePerHour, sortOrder, isActive } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อสนาม' }, { status: 400 })
    }

    const court = await db.court.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        pricePerHour: pricePerHour ?? 300,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })
    return NextResponse.json(court, { status: 201 })
  } catch (error) {
    console.error('Error creating court:', error)
    return NextResponse.json({ error: 'Failed to create court' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, pricePerHour, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Court ID is required' }, { status: 400 })
    }

    const court = await db.court.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(pricePerHour !== undefined ? { pricePerHour } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })
    return NextResponse.json(court)
  } catch (error) {
    console.error('Error updating court:', error)
    return NextResponse.json({ error: 'Failed to update court' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Court ID is required' }, { status: 400 })
    }

    // Soft delete: set isActive = false
    await db.court.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ message: 'Court deactivated' })
  } catch (error) {
    console.error('Error deleting court:', error)
    return NextResponse.json({ error: 'Failed to delete court' }, { status: 500 })
  }
}
