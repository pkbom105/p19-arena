import { NextResponse } from 'next/server'
import { CUSTOMER_SESSION_COOKIE, clearSessionCookie } from '@/lib/session-auth'

/**
 * ออกจากระบบฝั่งลูกค้า — ล้างคุกกี้เซสชันของแอป (p19_customer_session)
 * ฝั่ง client ต้องเรียก signOut() ของ next-auth ต่อด้วย เพื่อล้างเซสชัน Google (ถ้าล็อกอินด้วย Google)
 * ไม่งั้น MemberLoginGate จะ sync เซสชัน Google กลับเข้าให้ทันที
 */
export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response, CUSTOMER_SESSION_COOKIE)
  return response
}
