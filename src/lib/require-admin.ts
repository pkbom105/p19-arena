import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CUSTOMER_SESSION_COOKIE, readSessionToken } from '@/lib/session-auth'
import { canUseAdminApi, resolveProfileLevel, type ProfileLevel } from '@/lib/permissions'

/**
 * อ่าน "ระดับสิทธิ์" ของผู้ใช้ที่ล็อกอิน (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 * - ใช้ทั้งใน server component (dashboard layout) และ API route
 * - ระดับที่ได้ = resolveProfileLevel() → บัญชีเจ้าของงานเป็น super_admin เสมอ
 */
export interface SessionLevel {
  userId: string
  level: ProfileLevel
  name: string | null
  email: string | null
}

/** ดึงค่า token จาก header `cookie` (ใช้ได้ทั้ง Request และ NextRequest) */
function tokenFromCookieHeader(header: string | null): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (name !== CUSTOMER_SESSION_COOKIE) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

/** โหลดระดับสิทธิ์จาก DB ด้วย token ของคุกกี้เซสชัน (null = ยังไม่ล็อกอิน/ไม่พบโปรไฟล์) */
export async function loadSessionLevel(token: string | undefined): Promise<SessionLevel | null> {
  const session = readSessionToken(token)
  if (!session) return null
  try {
    const user = await db.user.findUnique({
      where: { id: session.subject },
      select: { id: true, name: true, email: true, level: true },
    })
    if (!user) return null
    return {
      userId: user.id,
      level: resolveProfileLevel(user),
      name: user.name,
      email: user.email,
    }
  } catch (error) {
    console.error('Failed to load profile level', error)
    return null
  }
}

/** สำหรับ server component — อ่านคุกกี้ของคำขอปัจจุบัน */
export async function getSessionLevelFromCookies(): Promise<SessionLevel | null> {
  const store = await cookies()
  return loadSessionLevel(store.get(CUSTOMER_SESSION_COOKIE)?.value)
}

/** สำหรับ API route */
export async function getSessionLevelFromRequest(request: Request): Promise<SessionLevel | null> {
  return loadSessionLevel(tokenFromCookieHeader(request.headers.get('cookie')))
}

/**
 * ตรวจสิทธิ์สำหรับ /api/admin/* — ต้องเป็น admin ขึ้นไป
 * ใช้: const guard = await requireAdminApi(request); if ('response' in guard) return guard.response
 */
export async function requireAdminApi(
  request: Request
): Promise<{ session: SessionLevel } | { response: NextResponse }> {
  const session = await getSessionLevelFromRequest(request)
  if (!session) {
    return { response: NextResponse.json({ error: 'ต้องเข้าสู่ระบบก่อน' }, { status: 401 }) }
  }
  if (!canUseAdminApi(session.level)) {
    return {
      response: NextResponse.json(
        { error: 'ไม่มีสิทธิ์ใช้งานส่วนแอดมิน (ต้องเป็นระดับ Admin ขึ้นไป)' },
        { status: 403 }
      ),
    }
  }
  return { session }
}
