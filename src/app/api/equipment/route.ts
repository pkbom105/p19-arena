import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'
    const paid = searchParams.get('paid') === '1'

    const items = await db.rentalEquipment.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // ?paid=1 — แสดงเฉพาะอุปกรณ์ที่ "ชำระเงินแล้ว" จาก 2 ช่องทาง:
    // (1) pos-shop: ชื่อสินค้าตรงกับรายการในใบเสร็จ (ShopReceipt items)
    // (2) จองสนาม: มีการเช่าแร็กเก็ต (racketCount > 0) และยืนยันชำระแล้ว (confirmed หรือมีสลิป)
    if (paid) {
      const receiptItems = await db.shopReceiptItem.findMany({
        select: { name: true },
        distinct: ['name'],
      })
      const paidNames = new Set(receiptItems.map((i) => i.name.trim()))

      const paidRacketBookings = await db.booking.count({
        where: {
          racketCount: { gt: 0 },
          OR: [{ status: 'confirmed' }, { slipDataUrl: { not: null } }],
        },
      })

      const isRacket = (name: string) => /แร็กเก็ต|racket/i.test(name)

      return NextResponse.json(
        items.filter((item) => {
          if (paidNames.has(item.name)) return true
          if (paidRacketBookings > 0 && isRacket(item.name)) return true
          return false
        })
      )
    }

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

    // Sync ราคา → สินค้าในร้าน (ShopProduct) ที่ชื่อตรงกัน (2 ทางกับ /api/shop-products)
    if (pricePerUnit !== undefined) {
      await db.shopProduct.updateMany({
        where: { name: item.name },
        data: { price: pricePerUnit },
      })
    }

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
    const hard = searchParams.get('hard') === '1'

    if (!id) {
      return NextResponse.json({ error: 'Equipment ID is required' }, { status: 400 })
    }

    if (hard) {
      await db.rentalEquipment.delete({ where: { id } })
      return NextResponse.json({ message: 'Equipment deleted permanently' })
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
