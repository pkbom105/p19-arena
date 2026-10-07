import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { CUSTOMER_SESSION_COOKIE, setSessionCookie } from '@/lib/session-auth'

/**
 * สะพานเชื่อมหลังล็อกอิน Google (next-auth → กระเป๋าเงินเดิม)
 *
 * หลังผู้ใช้ล็อกอิน Google สำเร็จ (เซสชันอยู่ในคุกกี้ของ next-auth) ฝั่งลูกค้าจะเรียก
 * POST /api/auth/google/sync เพื่อ:
 *   1) หา/สร้าง User จาก googleId แล้วอัปเดตโปรไฟล์
 *   2) ออกคุกกี้เซสชันเดิมของแอป (p19_customer_session) ให้กระเป๋าเงิน/Top-up ใช้ต่อ
 *
 * เหตุผล: API กระเป๋าเงินเดิมอ่านคุกกี้ตัวนี้เท่านั้น (getCustomerSession) — จึงไม่ต้องแก้ของเดิม
 * และทำให้ LINE login เดิมยังทำงานเหมือนเดิมทุกประการ
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  const googleId = session?.user?.googleId

  if (!session || !googleId) {
    return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
  }

  try {
    const email = session.user?.email ?? null
    const name = session.user?.name ?? null
    const picture = session.user?.image ?? null

    let user = await db.user.findUnique({ where: { googleId } })

    if (!user) {
      user = await db.user.create({
        data: {
          googleId,
          googleName: name,
          googlePictureUrl: picture,
          name,
          email,
          emailVerifiedAt: new Date(),
        },
      })
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          googleName: name ?? user.googleName,
          googlePictureUrl: picture ?? user.googlePictureUrl,
          email: email ?? user.email,
        },
      })
    }

    const response = NextResponse.json({
      id: user.id,
      name: user.googleName ?? user.name,
      email: user.email,
      walletBalance: user.walletBalance,
    })
    setSessionCookie(response, CUSTOMER_SESSION_COOKIE, user.id)
    return response
  } catch (error) {
    console.error('Failed to sync Google session', error)
    return NextResponse.json({ error: 'Failed to sync Google session' }, { status: 500 })
  }
}
