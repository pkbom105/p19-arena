import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sanitizeSlipVerify } from '@/lib/slip-verify'

export async function GET(request: Request) {
  try {
    /** scope=recent → คืนรายการล่าสุด "ทุกสถานะ" (ใช้กับตาราง "รายการ Top-up ล่าสุด") — ค่าเริ่มต้น = เฉพาะ pending */
    const scope = new URL(request.url).searchParams.get('scope')
    const requests = await db.topUpRequest.findMany({
      where: scope === 'recent' ? {} : { status: 'pending' },
      include: {
        user: {
          select: { id: true, lineDisplayName: true, name: true, phone: true, linePictureUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // ทำเครื่องหมายแถว "สลิปซ้ำ" (มี record อื่นใช้สลิปเดียวกัน) — แถวพวกนี้ห้ามอนุมัติ
    const slipKeys = Array.from(new Set(requests.map((r) => r.slipDataUrl)))
    const grouped = slipKeys.length
      ? await db.topUpRequest.groupBy({
          by: ['slipDataUrl'],
          where: { slipDataUrl: { in: slipKeys } },
          _count: { _all: true },
        })
      : []
    const duplicated = new Set(grouped.filter((g) => g._count._all > 1).map((g) => g.slipDataUrl))

    return NextResponse.json(requests.map((r) => ({ ...r, duplicate: duplicated.has(r.slipDataUrl) })))
  } catch (error) {
    console.error('Failed to load admin top-up requests', error)
    return NextResponse.json({ error: 'Failed to load top-up requests' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid review action' }, { status: 400 })
    }
    const { id, action } = body as Record<string, unknown>
    if (typeof id !== 'string' || !id || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'A request ID and valid action are required' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const topUp = await tx.topUpRequest.findUnique({ where: { id } })
      if (!topUp) return { kind: 'missing' as const }
      if (topUp.status !== 'pending') return { kind: 'reviewed' as const }

      const updated = await tx.topUpRequest.updateMany({
        where: { id, status: 'pending' },
        data: { status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date() },
      })
      if (updated.count !== 1) return { kind: 'reviewed' as const }

      if (action === 'approve') {
        // ห้ามอนุมัติสลิปซ้ำ — ถ้าสลิปเดียวกันถูกอนุมัติไปแล้ว (record อื่น) ให้ปฏิเสธ ไม่ให้เครดิตซ้ำ
        const approvedTwin = await tx.topUpRequest.findFirst({
          where: { slipDataUrl: topUp.slipDataUrl, status: 'approved', id: { not: topUp.id } },
          select: { id: true },
        })
        if (approvedTwin) return { kind: 'duplicate' as const }

        await tx.user.update({
          where: { id: topUp.userId },
          data: { walletBalance: { increment: topUp.amount } },
        })
      }
      return { kind: 'ok' as const, status: action === 'approve' ? 'approved' : 'rejected' }
    })

    if (result.kind === 'missing') return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 })
    if (result.kind === 'reviewed') return NextResponse.json({ error: 'Top-up request was already reviewed' }, { status: 409 })
    if (result.kind === 'duplicate')
      return NextResponse.json({ error: 'สลิปซ้ำ — สลิปนี้ถูกอนุมัติไปแล้ว' }, { status: 409 })
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    console.error('Failed to review top-up request', error)
    return NextResponse.json({ error: 'Failed to review top-up request' }, { status: 500 })
  }
}

const MAX_SLIP_BYTES = 300 * 1024

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = (base64.match(/=+$/) ?? [''])[0].length
  return Math.floor((base64.length * 3) / 4) - padding
}

/** แปลงผลตรวจสลิป (ส่งมาจาก client) → ฟิลด์ที่บันทึกลง DB — ใช้ตัวช่วยกลางจาก lib/slip-verify */

/**
 * บันทึกคำขอ Top-up ที่เคาน์เตอร์ — ผูก record กับลูกค้าใน DB (userId) สถานะตั้งต้น = pending
 * แล้วค่อยกดอนุมัติผ่าน PATCH เพื่อให้ยอดเข้ากระเป๋าลูกค้า
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid top-up request' }, { status: 400 })
    }
    const { userId, amount, slipName, slipDataUrl, verify } = body as Record<string, unknown>

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: 'Select the customer this slip belongs to' }, { status: 400 })
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid top-up amount' }, { status: 400 })
    }
    if (
      typeof slipDataUrl !== 'string' ||
      !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(slipDataUrl)
    ) {
      return NextResponse.json({ error: 'Upload a valid JPEG or PNG payment slip' }, { status: 400 })
    }
    if (dataUrlBytes(slipDataUrl) > MAX_SLIP_BYTES) {
      return NextResponse.json({ error: 'Payment slip exceeds 300 KB' }, { status: 400 })
    }

    const customer = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const safeSlipName =
      typeof slipName === 'string' && slipName.trim() ? slipName.trim().slice(0, 120) : 'payment-slip'

    // ห้ามสลิปซ้ำ — ใช้ data URL ของไฟล์เป็นลายนิ้วมือ (ไฟล์เดิมให้ base64 ตรงกันเสมอ ตรวจได้ข้ามการ refresh)
    const existing = await db.topUpRequest.findFirst({
      where: { slipDataUrl },
      select: { id: true, status: true },
      orderBy: { createdAt: 'asc' },
    })
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.status === 'approved'
              ? 'สลิปนี้เคยอนุมัติไปแล้ว — ห้ามใช้ซ้ำ'
              : 'สลิปนี้ถูกแนบไว้แล้ว (รออนุมัติ) — ห้ามใช้ซ้ำ',
          duplicateOf: existing.id,
          status: existing.status,
        },
        { status: 409 },
      )
    }

    const created = await db.topUpRequest.create({
      data: { userId, amount: Math.round(amount), slipName: safeSlipName, slipDataUrl, ...sanitizeSlipVerify(verify) },
      include: {
        user: {
          select: { id: true, lineDisplayName: true, name: true, phone: true, linePictureUrl: true },
        },
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Failed to create top-up request', error)
    return NextResponse.json({ error: 'Failed to create top-up request' }, { status: 500 })
  }
}
