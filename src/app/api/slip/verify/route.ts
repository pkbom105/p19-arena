import { NextRequest, NextResponse } from 'next/server'
import { hasSlip2GoSecret, parseSlipImageDataUrl, verifySlipWithSlip2Go } from '@/lib/slip-verify-server'

/**
 * ตรวจสลิปด้วย Slip2Go (ฝั่ง server เท่านั้น — ซ่อน secret ไม่ให้ client เห็น)
 *
 * ใช้ endpoint "qr-image/info": ส่ง "รูปสลิป" ไปให้ Slip2Go decode QR เอง (ไม่ต้องอ่าน QR ฝั่ง client)
 * แล้วเราตรวจเงื่อนไขเอง (ยอดเงิน + บัญชีผู้รับ) จากข้อมูลที่ได้กลับมา
 *
 * Request (จาก client): { slipDataUrl: string, expectedAmount?: number }
 * Response: { ok, code, message, found, amount, amountMatches, receiverText, receiverMatches }
 *
 * หมายเหตุ: ตรรกะการตรวจย้ายไปที่ `src/lib/slip-verify-server.ts` เพื่อให้
 * `POST /api/wallet/cash-card` (ประตูเครดิตเงิน) ตรวจซ้ำฝั่งเซิร์ฟเวอร์ได้ด้วยตรรกะเดียวกัน
 */
export async function POST(request: NextRequest) {
  if (!hasSlip2GoSecret()) {
    return NextResponse.json({ error: 'SLIP2GO_SECRET is not configured' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { slipDataUrl, expectedAmount } = body as { slipDataUrl?: unknown; expectedAmount?: unknown }

  if (typeof slipDataUrl !== 'string') {
    return NextResponse.json({ error: 'slipDataUrl is required' }, { status: 400 })
  }
  const parsed = parseSlipImageDataUrl(slipDataUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'slipDataUrl must be a JPEG/PNG data URL' }, { status: 400 })
  }

  const verified = await verifySlipWithSlip2Go(
    parsed,
    typeof expectedAmount === 'number' ? expectedAmount : undefined
  )
  if (!verified.ok) {
    const message =
      verified.reason === 'no-secret'
        ? 'SLIP2GO_SECRET is not configured'
        : verified.reason === 'upstream-http'
          ? `Slip2Go responded HTTP ${verified.detail}`
          : 'Slip verification failed'
    return NextResponse.json({ error: message }, { status: verified.status })
  }

  const result = verified.result
  return NextResponse.json({
    ok: true,
    code: result.code,
    message: result.message,
    found: result.found,
    duplicate: result.duplicate,
    amount: result.amount,
    amountMatches: result.amountMatches,
    receiverText: result.receiverText,
    receiverMatches: result.receiverMatches,
    // เลขอ้างอิง/วันที่ธุรกรรมจากธนาคาร (ไว้ตามรอย + บันทึก DB)
    transRef: result.transRef,
    transDate: result.transDate,
  })
}
