import { NextRequest, NextResponse } from 'next/server'

/**
 * ตรวจสลิปด้วย Slip2Go (ฝั่ง server เท่านั้น — ซ่อน secret ไม่ให้ client เห็น)
 *
 * ใช้ endpoint "qr-image/info": ส่ง "รูปสลิป" ไปให้ Slip2Go decode QR เอง (ไม่ต้องอ่าน QR ฝั่ง client)
 * แล้วเราตรวจเงื่อนไขเอง (ยอดเงิน + บัญชีผู้รับ) จากข้อมูลที่ได้กลับมา
 *
 * Request (จาก client): { slipDataUrl: string, expectedAmount?: number }
 * Response: { ok, code, message, found, amount, amountMatches, receiverText, receiverMatches }
 */

const SLIP2GO_BASE =
  process.env.SLIP2GO_BASE_URL?.replace(/\/+$/, '') || 'https://connect.slip2go.com/api'

/** เบอร์พร้อมเพย์ (ร้านรับเงิน) — ใช้เทียบ "บัญชีผู้รับ" ในสลิป (ตรงกับ generatePromptPayQR) */
const PROMPTPAY_TARGET = '0896993979'

function parseImageDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) return null
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export async function POST(request: NextRequest) {
  const secret = process.env.SLIP2GO_SECRET
  if (!secret || secret.trim() === '') {
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
  const parsed = parseImageDataUrl(slipDataUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'slipDataUrl must be a JPEG/PNG data URL' }, { status: 400 })
  }

  const ext = parsed.mime === 'image/png' ? 'png' : 'jpg'
  const form = new FormData()
  form.append(
    'file',
    new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mime }),
    `slip.${ext}`
  )
  // เปิดตรวจสลิปซ้ำ (Slip2Go checkDuplicate) — กันสลิปเดิมถูกใช้ซ้ำข้ามไฟล์/ข้ามการเซฟใหม่
  // (ส่งเป็น form field ชื่อ "payload" ตามสเปก endpoint qr-image)
  form.append('payload', JSON.stringify({ checkDuplicate: true }))

  try {
    const res = await fetch(`${SLIP2GO_BASE}/verify-slip/qr-image/info`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      body: form,
      cache: 'no-store',
    })
    const raw: unknown = await res.json().catch(() => null)
    if (!res.ok || typeof raw !== 'object' || raw === null) {
      console.error('Slip2Go verify non-ok response', res.status, raw)
      return NextResponse.json({ error: `Slip2Go responded HTTP ${res.status}` }, { status: 502 })
    }

    const result = raw as { code?: string | number; message?: string; data?: Record<string, unknown> }
    const data = result.data ?? {}
    const amount = typeof data.amount === 'number' ? data.amount : null

    const receiver = (data.receiver ?? {}) as Record<string, unknown>
    const receiverAccount = (receiver.account ?? {}) as Record<string, unknown>
    const receiverProxy = (receiverAccount.proxy ?? {}) as Record<string, unknown>
    const receiverBank = (receiverAccount.bank ?? {}) as Record<string, unknown>
    const receiverText = [receiverProxy.account, receiverBank.account, receiverAccount.name]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(' · ')

    const code = result.code != null ? String(result.code) : null
    // 200501 = Slip is Duplicated (สลิปซ้ำในระบบ Slip2Go)
    const duplicate = code === '200501'
    const found = !duplicate && (code === '200000' || code === '200200')
    const amountMatches =
      typeof expectedAmount === 'number' && amount !== null
        ? Math.abs(amount - expectedAmount) < 0.01
        : null

    // Slip2Go มาสก์เลขบัญชี (เหลือท้าย 4 ตัว เช่น xxx-xxx-3979) → เทียบ "เลขท้าย 4 ตัว" กับเบอร์พร้อมเพย์ร้าน
    const last4 = PROMPTPAY_TARGET.replace(/\D/g, '').slice(-4)
    const receiverDigits = [receiverProxy.account, receiverBank.account]
      .filter((v): v is string => typeof v === 'string')
      .map((s) => s.replace(/\D/g, ''))
      .filter((s) => s.length >= 4)
    const receiverMatches =
      receiverDigits.length > 0 ? receiverDigits.some((d) => d.endsWith(last4)) : null

    return NextResponse.json({
      ok: true,
      code,
      message: result.message ?? null,
      found,
      duplicate,
      amount,
      amountMatches,
      receiverText: receiverText || null,
      receiverMatches,
      // เลขอ้างอิง/วันที่ธุรกรรมจากธนาคาร (ไว้ตามรอย + บันทึก DB)
      transRef: typeof data.transRef === 'string' ? data.transRef : null,
      transDate: typeof data.transDate === 'string' ? data.transDate : null,
    })
  } catch (error) {
    console.error('Slip2Go verify failed', error)
    return NextResponse.json({ error: 'Slip verification failed' }, { status: 502 })
  }
}
