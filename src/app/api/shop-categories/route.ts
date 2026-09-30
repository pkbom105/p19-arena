import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { ensureShopCategories, slugifyShopCategory, toShopCategory } from '@/lib/shop-categories'

/** GET /api/shop-categories — ปกติ = เฉพาะที่เปิดใช้งาน · ?all=1 = รวมที่ปิดใช้งาน (หน้าตั้งค่า) */
export async function GET(request: NextRequest) {
  try {
    await ensureShopCategories()
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'

    const rows = await db.shopCategory.findMany({
      where: all ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(rows.map(toShopCategory))
  } catch (error) {
    console.error('Error fetching shop categories:', error)
    return NextResponse.json({ error: 'Failed to fetch shop categories' }, { status: 500 })
  }
}

/**
 * DELETE /api/shop-categories?id=... — ลบถาวร
 * กันไว้: ถ้ายังมีสินค้าใช้หมวดนี้อยู่ จะไม่ลบ (สินค้าจะแสดงรหัสหมวดที่ไม่มีชื่อ)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Shop category ID is required' }, { status: 400 })
    }

    const exists = await db.shopCategory.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'ไม่พบหมวดนี้' }, { status: 404 })
    }

    const usedBy = await db.shopProduct.count({ where: { category: id } })
    if (usedBy > 0) {
      return NextResponse.json(
        { error: `หมวดนี้มีสินค้าอยู่ ${usedBy} รายการ — ต้องย้ายหรือลบสินค้าก่อน` },
        { status: 400 },
      )
    }

    await db.shopCategory.delete({ where: { id } })
    return NextResponse.json({ message: 'Shop category deleted permanently' })
  } catch (error) {
    console.error('Error deleting shop category:', error)
    return NextResponse.json({ error: 'Failed to delete shop category' }, { status: 500 })
  }
}

/** PUT /api/shop-categories — แก้ไขหมวด (ส่งเฉพาะฟิลด์ที่แก้ก็ได้ · ไม่แก้ id เพราะสินค้าอ้างอิงอยู่) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, label, labelEn, emoji, sortOrder, isActive } = body

    if (!id?.trim()) {
      return NextResponse.json({ error: 'Shop category ID is required' }, { status: 400 })
    }
    if (label !== undefined && !String(label).trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อหมวดสินค้า' }, { status: 400 })
    }
    if (sortOrder !== undefined && typeof sortOrder !== 'number') {
      return NextResponse.json({ error: 'ลำดับต้องเป็นตัวเลข' }, { status: 400 })
    }

    const exists = await db.shopCategory.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'ไม่พบหมวดนี้' }, { status: 404 })
    }

    const item = await db.shopCategory.update({
      where: { id },
      data: {
        ...(label !== undefined ? { label: String(label).trim() } : {}),
        ...(labelEn !== undefined ? { labelEn: String(labelEn).trim() || null } : {}),
        ...(emoji !== undefined ? { emoji: String(emoji).trim() || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive: isActive === true } : {}),
      },
    })
    return NextResponse.json(toShopCategory(item))
  } catch (error) {
    console.error('Error updating shop category:', error)
    return NextResponse.json({ error: 'Failed to update shop category' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureShopCategories()
    const body = await request.json()
    const { id, label, labelEn, emoji, sortOrder } = body

    if (!label?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อหมวดสินค้า' }, { status: 400 })
    }

    const slug = await slugifyShopCategory(String(id?.trim() || labelEn?.trim() || label))
    const dup = await db.shopCategory.findUnique({ where: { id: slug }, select: { id: true } })
    if (dup) {
      return NextResponse.json({ error: `มีหมวดรหัส "${slug}" อยู่แล้ว` }, { status: 400 })
    }

    // ลำดับเริ่มต้น = ต่อท้ายหมวดที่มีอยู่
    const last = await db.shopCategory.aggregate({ _max: { sortOrder: true } })

    const item = await db.shopCategory.create({
      data: {
        id: slug,
        label: label.trim(),
        labelEn: labelEn?.trim() || null,
        emoji: emoji?.trim() || null,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : (last._max.sortOrder ?? 0) + 1,
      },
    })
    return NextResponse.json(toShopCategory(item), { status: 201 })
  } catch (error) {
    console.error('Error creating shop category:', error)
    return NextResponse.json({ error: 'Failed to create shop category' }, { status: 500 })
  }
}
