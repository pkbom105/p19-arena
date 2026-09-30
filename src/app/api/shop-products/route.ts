import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { isValidShopCategory } from '@/lib/shop-categories'

/**
 * ยอดขายจริงต่อชื่อสินค้า (นับจากรายการในใบเสร็จ ShopReceiptItem)
 * ใช้คำนวณ "คงเหลือ" ของสินค้าในหน้าตั้งค่า — จับคู่ด้วยชื่อสินค้า ณ วันที่ขาย
 */
async function soldQtyByName() {
  const rows = await db.shopReceiptItem.groupBy({ by: ['name'], _sum: { qty: true } })
  return new Map(rows.map((r) => [r.name.trim(), r._sum.qty ?? 0]))
}

/** GET /api/shop-products — ปกติ = เฉพาะที่เปิดใช้งาน · ?all=1 = รวมที่ปิดใช้งาน + ยอดขายจริง/คงเหลือ (หน้าตั้งค่า) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'

    const items = await db.shopProduct.findMany({
      where: all ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (!all) return NextResponse.json(items)

    // หน้าตั้งค่า: แนบจำนวนขายจริง + คงเหลือ (ติดลบได้ = ขายเกินสต็อกตั้งต้น)
    const sold = await soldQtyByName()
    return NextResponse.json(
      items.map((p) => {
        const soldQty = sold.get(p.name.trim()) ?? 0
        return { ...p, soldQty, stockLeft: p.stockStart - soldQty }
      })
    )
  } catch (error) {
    console.error('Error fetching shop products:', error)
    return NextResponse.json({ error: 'Failed to fetch shop products' }, { status: 500 })
  }
}

/** POST /api/shop-products — เพิ่มสินค้าใหม่ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, nameEn, category, price, unit, emoji, sortOrder, isActive, stockStart, costPrice } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้า' }, { status: 400 })
    }
    if (!(await isValidShopCategory(category))) {
      return NextResponse.json({ error: 'หมวดสินค้าไม่ถูกต้อง' }, { status: 400 })
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json({ error: 'ราคาต้องเป็นตัวเลขไม่ติดลบ' }, { status: 400 })
    }
    if (stockStart !== undefined && (!Number.isInteger(stockStart) || stockStart < 0)) {
      return NextResponse.json({ error: 'จำนวนเริ่มต้นต้องเป็นจำนวนเต็มไม่ติดลบ' }, { status: 400 })
    }
    if (costPrice !== undefined && (typeof costPrice !== 'number' || costPrice < 0)) {
      return NextResponse.json({ error: 'ราคาทุนต้องเป็นตัวเลขไม่ติดลบ' }, { status: 400 })
    }

    const item = await db.shopProduct.create({
      data: {
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        category,
        price: price ?? 0,
        stockStart: stockStart ?? 0,
        costPrice: costPrice ?? 0,
        unit: unit?.trim() || 'ชิ้น',
        emoji: emoji?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating shop product:', error)
    return NextResponse.json({ error: 'Failed to create shop product' }, { status: 500 })
  }
}

/** PUT /api/shop-products — แก้ไขสินค้า (ส่งเฉพาะฟิลด์ที่แก้ก็ได้) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, nameEn, category, price, unit, emoji, sortOrder, isActive, stockStart, costPrice } = body

    if (!id) {
      return NextResponse.json({ error: 'Shop product ID is required' }, { status: 400 })
    }
    if (category !== undefined && !(await isValidShopCategory(category))) {
      return NextResponse.json({ error: 'หมวดสินค้าไม่ถูกต้อง' }, { status: 400 })
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json({ error: 'ราคาต้องเป็นตัวเลขไม่ติดลบ' }, { status: 400 })
    }
    if (stockStart !== undefined && (!Number.isInteger(stockStart) || stockStart < 0)) {
      return NextResponse.json({ error: 'จำนวนเริ่มต้นต้องเป็นจำนวนเต็มไม่ติดลบ' }, { status: 400 })
    }
    if (costPrice !== undefined && (typeof costPrice !== 'number' || costPrice < 0)) {
      return NextResponse.json({ error: 'ราคาทุนต้องเป็นตัวเลขไม่ติดลบ' }, { status: 400 })
    }

    const item = await db.shopProduct.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(nameEn !== undefined ? { nameEn: nameEn?.trim() || null } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(stockStart !== undefined ? { stockStart } : {}),
        ...(costPrice !== undefined ? { costPrice } : {}),
        ...(unit !== undefined ? { unit: unit?.trim() || 'ชิ้น' } : {}),
        ...(emoji !== undefined ? { emoji: emoji?.trim() || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating shop product:', error)
    return NextResponse.json({ error: 'Failed to update shop product' }, { status: 500 })
  }
}

/**
 * DELETE /api/shop-products?id=... — ปิดใช้งาน (soft delete ไม่ลบแถวจริง)
 * ?hard=1 = ลบถาวรจริง (ใช้จากปุ่ม "ลบถาวร" ซึ่งแสดงเฉพาะรายการที่ปิดใช้งานแล้ว)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const hard = searchParams.get('hard') === '1'

    if (!id) {
      return NextResponse.json({ error: 'Shop product ID is required' }, { status: 400 })
    }

    if (hard) {
      await db.shopProduct.delete({ where: { id } })
      return NextResponse.json({ message: 'Shop product deleted permanently' })
    }

    await db.shopProduct.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ message: 'Shop product deactivated' })
  } catch (error) {
    console.error('Error deleting shop product:', error)
    return NextResponse.json({ error: 'Failed to delete shop product' }, { status: 500 })
  }
}
