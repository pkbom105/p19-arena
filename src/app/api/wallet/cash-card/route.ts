import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/session-auth'
import { findCashCard } from '@/lib/cash-cards'
import { isSlipFullyVerified, parseSlipImageDataUrl, verifySlipWithSlip2Go } from '@/lib/slip-verify-server'
import { sanitizeSlipVerify } from '@/lib/slip-verify'

const MAX_SLIP_BYTES = 300 * 1024

/** ขนาดไฟล์จริงจาก data URL (base64) — ใช้กติกาเดียวกับ /api/wallet/topups */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = (base64.match(/=+$/) ?? [''])[0].length
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * POST /api/wallet/cash-card — สมาชิกส่งสลิปของ Cash Card จากหน้า /member/profile/wallet
 *
 * หลักการเงิน (สำคัญ — อ่านก่อนแก้):
 *  1) **ยอดที่เครดิตคิดจาก "การ์ดที่เลือก" ฝั่งเซิร์ฟเวอร์เท่านั้น** (client ส่งมาแค่ `cardId`)
 *     ห้ามเชื่อยอดที่ client ส่งมา (กันแก้ยอดในเบราว์เซอร์) และ **ไม่ใช้ยอดจาก OCR ในสลิป**
 *  2) **ตรวจสลิปซ้ำ 2 ชั้น**: ใน DB ของเรา (slipDataUrl ซ้ำ) + Slip2Go `checkDuplicate`
 *  3) **เครดิตทันทีเฉพาะเมื่อผ่านครบทุกข้อ**: สลิปจริง · ไม่ซ้ำ · ยอดในสลิปตรงกับ `pay` ของการ์ด · ผู้รับตรง
 *     ถ้าไม่ผ่านครบ → บันทึกเป็น `pending` ให้เจ้าหน้าที่ตรวจ (ไม่เครดิต) — ปลอดภัยกว่า
 *  4) สร้างรายการ TopUpRequest + เพิ่มยอดกระเป๋า **ใน transaction เดียวกัน** (กันเครดิตซ้ำ/สำเร็จครึ่งเดียว)
 *  5) ต้องใช้เซสชันลูกค้า (ห้ามเรียก /api/admin/topups จากหน้าเว็บลูกค้า — endpoint นั้นไม่มีการตรวจสิทธิ์)
 */
export async function POST(request: NextRequest) {
  const session = getCustomerSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { cardId, slipName, slipDataUrl } = body as Record<string, unknown>

    const card = findCashCard(cardId)
    if (!card) {
      return NextResponse.json({ error: 'Unknown cash card' }, { status: 400 })
    }

    if (typeof slipDataUrl !== 'string') {
      return NextResponse.json({ error: 'slipDataUrl is required' }, { status: 400 })
    }
    const image = parseSlipImageDataUrl(slipDataUrl)
    if (!image) {
      return NextResponse.json({ error: 'Upload a valid JPEG or PNG payment slip' }, { status: 400 })
    }
    if (dataUrlBytes(slipDataUrl) > MAX_SLIP_BYTES) {
      return NextResponse.json({ error: 'Payment slip exceeds 300 KB' }, { status: 400 })
    }

    // สลิปนี้เคยถูกใช้ในระบบเราหรือยัง (Slip2Go จะตรวจจับสลิปซ้ำให้อีกชั้นตอนตรวจ)
    const alreadyUsed = await db.topUpRequest.findFirst({
      where: { slipDataUrl },
      select: { id: true },
    })
    if (alreadyUsed) {
      return NextResponse.json({ error: 'สลิปนี้ถูกใช้ไปแล้ว' }, { status: 409 })
    }

    // ตรวจสลิปฝั่งเซิร์ฟเวอร์เอง (ไม่เชื่อผลตรวจที่ browser ส่งมา) — ยอดที่คาดหวัง = ยอดที่ต้องจ่ายของการ์ด
    const verified = await verifySlipWithSlip2Go(image, card.pay)
    const fullyVerified = verified.ok ? isSlipFullyVerified(verified.result) : false

    const safeSlipName =
      typeof slipName === 'string' && slipName.trim() ? slipName.trim().slice(0, 120) : 'cash-card-slip'
    /** ยอดที่ได้เข้ากระเป๋า — มาจากข้อมูลการ์ดเท่านั้น */
    const amount = card.get
    /** ผลตรวจที่จะบันทึก (รูปแบบเดียวกับที่หน้าแอดมินบันทึก) */
    const verifyColumns = sanitizeSlipVerify(
      verified.ok
        ? {
            status: fullyVerified ? 'ok' : 'fail',
            code: verified.result.code,
            amount: verified.result.amount,
            receiver: verified.result.receiverText,
            transRef: verified.result.transRef,
          }
        : { status: 'error', code: null, amount: null, receiver: null, transRef: null }
    )
    const now = new Date()

    const outcome = await db.$transaction(async (tx) => {
      const created = await tx.topUpRequest.create({
        data: {
          userId: session.subject,
          amount,
          slipName: safeSlipName,
          slipDataUrl,
          status: fullyVerified ? 'approved' : 'pending',
          reviewedAt: fullyVerified ? now : null,
          ...verifyColumns,
        },
        select: { id: true, amount: true, status: true, createdAt: true },
      })

      if (!fullyVerified) {
        const current = await tx.user.findUnique({
          where: { id: session.subject },
          select: { walletBalance: true },
        })
        return { created, walletBalance: current?.walletBalance ?? 0 }
      }

      const updated = await tx.user.update({
        where: { id: session.subject },
        data: { walletBalance: { increment: amount } },
        select: { walletBalance: true },
      })
      return { created, walletBalance: updated.walletBalance }
    })

    return NextResponse.json({
      ok: true,
      credited: fullyVerified,
      amount,
      status: outcome.created.status,
      walletBalance: outcome.walletBalance,
      topUpRequestId: outcome.created.id,
      verify: {
        found: verified.ok ? verified.result.found : false,
        duplicate: verified.ok ? verified.result.duplicate : false,
        amountMatches: verified.ok ? verified.result.amountMatches : null,
        receiverMatches: verified.ok ? verified.result.receiverMatches : null,
      },
      message: fullyVerified
        ? `เติมเงินสำเร็จ — กระเป๋าได้รับ ${amount.toLocaleString('th-TH')} บาท`
        : 'ได้รับสลิปแล้ว — รอเจ้าหน้าที่ตรวจสอบก่อนเครดิตเข้ากระเป๋า',
    })
  } catch (error) {
    console.error('Failed to submit cash card top-up', error)
    return NextResponse.json({ error: 'Failed to submit cash card top-up' }, { status: 500 })
  }
}
