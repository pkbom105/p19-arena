/**
 * ตัวช่วยตรวจสลิป (Slip2Go) ที่ API route หลายตัวใช้ร่วมกัน
 * (เดิมเขียนซ้ำใน api/bookings + api/admin/topups)
 */

export interface SlipVerifyColumns {
  verifyStatus: string | null
  verifyCode: string | null
  verifyAmount: number | null
  verifyReceiver: string | null
  verifyTransRef: string | null
  verifiedAt: Date | null
}

/** ค่าว่าง = ยังไม่มีผลตรวจ (ทุกคอลัมน์เป็น null) */
const EMPTY: SlipVerifyColumns = {
  verifyStatus: null,
  verifyCode: null,
  verifyAmount: null,
  verifyReceiver: null,
  verifyTransRef: null,
  verifiedAt: null,
}

/** แปลงผลตรวจสลิป (ส่งมาจาก client) → ฟิลด์ที่บันทึกลง DB (ไม่มี/ผลไม่ถูกต้อง = null ทั้งชุด) */
export function sanitizeSlipVerify(value: unknown): SlipVerifyColumns {
  if (typeof value !== 'object' || value === null) return EMPTY
  const v = value as Record<string, unknown>
  const status = v.status === 'ok' || v.status === 'fail' || v.status === 'error' ? v.status : null
  if (!status) return EMPTY
  return {
    verifyStatus: status,
    verifyCode: typeof v.code === 'string' ? v.code.slice(0, 24) : null,
    verifyAmount: typeof v.amount === 'number' && Number.isFinite(v.amount) ? Math.round(v.amount) : null,
    verifyReceiver: typeof v.receiver === 'string' ? v.receiver.slice(0, 200) : null,
    verifyTransRef: typeof v.transRef === 'string' ? v.transRef.slice(0, 120) : null,
    verifiedAt: new Date(),
  }
}
