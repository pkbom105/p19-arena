/**
 * ตรวจสลิปกับ Slip2Go — **ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น** (secret ไม่รั่วออกไปฝั่ง client)
 *
 * ไฟล์นี้เป็นแหล่งความจริงเดียวของ "ผลตรวจสลิป" ใช้ร่วมกัน 2 ที่:
 *   1) `POST /api/slip/verify` — ให้หน้าเว็บโชว์สถานะตรวจสลิปแบบสด (ผลตรวจเฉย ๆ ไม่แตะเงิน)
 *   2) `POST /api/wallet/cash-card` — ใช้เป็น **ประตูตัดสินว่าเงินจะเข้าเลยหรือรออนุมัติ** (แตะเงิน)
 *
 * เหตุผลที่ต้องมีตัวนี้: ผลตรวจที่ browser ได้รับสามารถถูกปลอมได้ จึงต้องตรวจซ้ำฝั่งเซิร์ฟเวอร์ก่อนเครดิตเงิน
 */

const SLIP2GO_BASE =
  process.env.SLIP2GO_BASE_URL?.replace(/\/+$/, '') || 'https://connect.slip2go.com/api'

/** เบอร์พร้อมเพย์ (ร้านรับเงิน) — ใช้เทียบ "บัญชีผู้รับ" ในสลิป (ตรงกับ generatePromptPayQR) */
export const PROMPTPAY_TARGET = '0896993979'

export interface SlipImage {
  buffer: Buffer
  mime: string
}

export interface SlipVerifyResult {
  code: string | null
  message: string | null
  /** สลิปจริงในระบบ Slip2Go (และไม่ซ้ำ) */
  found: boolean
  /** สลิปซ้ำในระบบ Slip2Go */
  duplicate: boolean
  amount: number | null
  /** ยอดในสลิปตรงกับที่คาด (null = ไม่ได้ส่งยอดที่คาดมา) */
  amountMatches: boolean | null
  receiverText: string | null
  /** ผู้รับตรงกับเบอร์พร้อมเพย์ของร้าน (null = ไม่มีข้อมูลให้เทียบ) */
  receiverMatches: boolean | null
  transRef: string | null
  transDate: string | null
}

/** อ่าน data URL ของรูปสลิป (jpeg/png) → buffer + mime */
export function parseSlipImageDataUrl(dataUrl: string): SlipImage | null {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) return null
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export function hasSlip2GoSecret(): boolean {
  const secret = process.env.SLIP2GO_SECRET
  return typeof secret === 'string' && secret.trim() !== ''
}

/**
 * ส่งรูปสลิปให้ Slip2Go decode QR แล้วอ่านข้อมูลผู้รับ/ยอดเงิน
 * คืน { ok: false, status, detail } เมื่อตรวจไม่ได้ (ปลายทางจะไม่เครดิตเงินให้ — ปลอดภัยกว่า)
 *   - reason 'no-secret' → ยังไม่ได้ตั้ง SLIP2GO_SECRET
 *   - reason 'upstream-http' → Slip2Go ตอบไม่ใช่ 2xx (detail = HTTP status)
 *   - reason 'network' → เรียกไม่สำเร็จ/อ่านผลไม่ได้
 */
export async function verifySlipWithSlip2Go(
  image: SlipImage,
  expectedAmount?: number
): Promise<
  | { ok: true; result: SlipVerifyResult }
  | { ok: false; status: number; reason: 'no-secret' | 'upstream-http' | 'network'; detail?: string }
> {
  const secret = process.env.SLIP2GO_SECRET
  if (!secret || secret.trim() === '') {
    return { ok: false, status: 500, reason: 'no-secret' }
  }

  const ext = image.mime === 'image/png' ? 'png' : 'jpg'
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(image.buffer)], { type: image.mime }), `slip.${ext}`)
  // เปิดตรวจสลิปซ้ำ (Slip2Go checkDuplicate) — กันสลิปเดิมถูกใช้ซ้ำข้ามไฟล์/ข้ามการเซฟใหม่
  form.append('payload', JSON.stringify({ checkDuplicate: true }))

  let response: Response
  try {
    response = await fetch(`${SLIP2GO_BASE}/verify-slip/qr-image/info`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      body: form,
      cache: 'no-store',
    })
  } catch (error) {
    console.error('Slip2Go verify failed', error)
    return { ok: false, status: 502, reason: 'network' }
  }

  const raw: unknown = await response.json().catch(() => null)
  if (!response.ok || typeof raw !== 'object' || raw === null) {
    console.error('Slip2Go verify non-ok response', response.status, raw)
    return { ok: false, status: 502, reason: 'upstream-http', detail: String(response.status) }
  }

  const payload = raw as { code?: string | number; message?: string; data?: Record<string, unknown> }
  const data = payload.data ?? {}
  const amount = typeof data.amount === 'number' ? data.amount : null

  const receiver = (data.receiver ?? {}) as Record<string, unknown>
  const receiverAccount = (receiver.account ?? {}) as Record<string, unknown>
  const receiverProxy = (receiverAccount.proxy ?? {}) as Record<string, unknown>
  const receiverBank = (receiverAccount.bank ?? {}) as Record<string, unknown>
  const receiverText = [receiverProxy.account, receiverBank.account, receiverAccount.name]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' · ')

  const code = payload.code != null ? String(payload.code) : null
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
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/\D/g, ''))
    .filter((value) => value.length >= 4)
  const receiverMatches =
    receiverDigits.length > 0 ? receiverDigits.some((digits) => digits.endsWith(last4)) : null

  return {
    ok: true,
    result: {
      code,
      message: payload.message ?? null,
      found,
      duplicate,
      amount,
      amountMatches,
      receiverText: receiverText || null,
      receiverMatches,
      transRef: typeof data.transRef === 'string' ? data.transRef : null,
      transDate: typeof data.transDate === 'string' ? data.transDate : null,
    },
  }
}

/**
 * "ผ่านครบทุกข้อ" หรือไม่ — เงื่อนไขเดียวที่อนุญาตให้เครดิตเงินเข้ากระเป๋าทันที
 * ต้องครบทั้ง 4 ข้อ: สลิปจริง · ไม่ซ้ำ · ยอดตรง · ผู้รับตรง
 */
export function isSlipFullyVerified(result: SlipVerifyResult): boolean {
  return (
    result.found === true &&
    result.duplicate === false &&
    result.amountMatches === true &&
    result.receiverMatches === true
  )
}
