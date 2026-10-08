import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

/**
 * ระดับสมาชิก (Member Level A / B) — กติกางานเคส E
 *
 * - **ระดับ A** = โปรไฟล์เดียวกันผูกทั้ง LINE และ Google (Gmail) ไว้ → **มี Wallet ID** และใช้โปรโมชัน/ส่วนลดพิเศษได้
 * - **ระดับ B** = ผูกไม่ครบ → **ยังไม่มี Wallet ID** (หน้าโปรไฟล์จะแสดงปุ่มเชื่อมช่องทางที่ขาด + โน้ตเชิญชวน)
 *
 * **บัญชีที่ยกเว้น (เจ้าของงานสั่ง):** ถือเป็นระดับ A ถาวรโดยไม่ต้องผูกช่องทางให้ครบ
 * เก็บเป็นรหัสถาวรของช่องทางนั้น (ไม่ใช่ id ใน DB) เพื่อให้คงอยู่แม้ย้าย/รีเซ็ตฐานข้อมูล
 */
export const LEVEL_A_EXEMPT_LINE_USER_IDS = ['Uda3c19f1ce8443df7238a545ea9f6fa4']

/** อีเมล Google ที่ยกเว้น — ใช้กับบัญชีที่ล็อกอินด้วย Gmail (ต้องมี googleId จริงในแถวนั้น) */
export const LEVEL_A_EXEMPT_GOOGLE_EMAILS = ['thaitanic99@gmail.com']

/** คำนำหน้ารหัสกระเป๋า: P19-XXXXXX */
export const WALLET_CODE_PREFIX = 'P19-'

/** ตัวอักษรที่ใช้สุ่ม — ตัด I, O, 0, 1 ออกเพราะอ่านสับสน */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface MemberChannelState {
  lineUserId?: string | null
  googleId?: string | null
  email?: string | null
  walletCode?: string | null
}

/** ระดับ A หรือไม่ — ใช้เป็นแหล่งความจริงเดียวทั้งฝั่ง API และหน้าโปรไฟล์ */
export function isLevelA(user: MemberChannelState): boolean {
  // ผูกครบทั้ง LINE และ Google
  if (user.lineUserId && user.googleId) return true

  // ยกเว้นตามบัญชี LINE
  if (user.lineUserId && LEVEL_A_EXEMPT_LINE_USER_IDS.includes(user.lineUserId)) return true

  // ยกเว้นตามอีเมล Google (ต้องเป็นบัญชีที่ล็อกอิน Gmail จริง = มี googleId)
  const email = user.email?.trim().toLowerCase()
  if (user.googleId && email && LEVEL_A_EXEMPT_GOOGLE_EMAILS.includes(email)) return true

  return false
}

/** สุ่มรหัสกระเป๋า 1 รหัส (ยังไม่ตรวจซ้ำกับฐานข้อมูล) */
export function generateWalletCode(length = 6): string {
  const bytes = randomBytes(length)
  let suffix = ''
  for (let index = 0; index < length; index += 1) {
    suffix += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length]
  }
  return `${WALLET_CODE_PREFIX}${suffix}`
}

/**
 * ออกรหัสกระเป๋าให้ผู้ใช้ระดับ A (idempotent — เรียกซ้ำได้ ไม่สร้างใหม่ถ้ามีแล้ว)
 * คืนรหัสกระเป๋า หรือ null ถ้ายังไม่ถึงระดับ A / ออกไม่สำเร็จ
 */
export async function ensureWalletCode(
  user: { id: string } & MemberChannelState
): Promise<string | null> {
  if (!isLevelA(user)) return null
  if (user.walletCode) return user.walletCode

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateWalletCode()
    const taken = await db.user.findUnique({ where: { walletCode: code }, select: { id: true } })
    if (taken) continue
    try {
      const updated = await db.user.update({
        where: { id: user.id },
        data: { walletCode: code },
        select: { walletCode: true },
      })
      return updated.walletCode
    } catch (error) {
      console.error('Failed to assign wallet code', error)
    }
  }
  return null
}
