import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/** GET /api/shop-receipts — ใบเสร็จล่าสุดก่อน (ค่าเริ่มต้น 50 ใบ) · ?limit=100 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

    const rows = await db.shopReceipt.findMany({
      orderBy: { soldAt: 'desc' },
      take: limit,
      include: { items: true },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching shop receipts:', error)
    return NextResponse.json({ error: 'Failed to fetch shop receipts' }, { status: 500 })
  }
}

/**
 * POST /api/shop-receipts — บันทึกใบเสร็จที่ปิดการขายจากหน้าแคชเชียร์ (/dashboard/pos-shop)
 * body: { subtotal, discount, total, method, received, change, items: [{ name, qty, price }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subtotal, discount, total, method, received, change, items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการสินค้าในบิล' }, { status: 400 })
    }
    if (typeof total !== 'number' || total < 0) {
      return NextResponse.json({ error: 'ยอดสุทธิไม่ถูกต้อง' }, { status: 400 })
    }
    if (method !== 'cash' && method !== 'transfer') {
      return NextResponse.json({ error: 'วิธีชำระเงินไม่ถูกต้อง' }, { status: 400 })
    }

    // เลขที่บิลรันต่อวัน (ใช้ภายใน/เรียงลำดับ)
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const todayCount = await db.shopReceipt.count({ where: { soldAt: { gte: startOfDay } } })

    // เลขที่บิลที่แสดงให้ลูกค้า: S-YYMM### (running 3 หลัก รีเซ็ตทุกเดือน — ต่อจากบิลล่าสุดของเดือนนั้น)
    const prefix = `S-${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastOfMonth = await db.shopReceipt.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    })
    const lastRunning = Number.parseInt((lastOfMonth?.code ?? '').slice(prefix.length), 10)
    const code = `${prefix}${String((Number.isFinite(lastRunning) ? lastRunning : 0) + 1).padStart(3, '0')}`

    const cleanItems = items.map((i: { name?: string; qty?: number; price?: number; note?: string }) => ({
      name: String(i?.name ?? '').trim() || 'ไม่ระบุชื่อ',
      qty: Math.max(1, Number(i?.qty) || 1),
      price: Math.max(0, Number(i?.price) || 0),
      note: i?.note ? String(i.note).trim() || null : null,
    }))

    const receipt = await db.shopReceipt.create({
      data: {
        code,
        no: todayCount + 1,
        subtotal: Math.max(0, Number(subtotal) || 0),
        discount: Math.max(0, Number(discount) || 0),
        total,
        method,
        received: Math.max(0, Number(received) || 0),
        change: Math.max(0, Number(change) || 0),
        itemCount: cleanItems.reduce((sum, i) => sum + i.qty, 0),
        items: { create: cleanItems },
      },
      include: { items: true },
    })
    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    console.error('Error creating shop receipt:', error)
    return NextResponse.json({ error: 'Failed to create shop receipt' }, { status: 500 })
  }
}
