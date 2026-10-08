import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { CUSTOMER_SESSION_COOKIE, getCustomerSession, setSessionCookie } from '@/lib/session-auth'

/**
 * สะพานเชื่อมหลังล็อกอิน Google (next-auth → กระเป๋าเงินเดิม)
 *
 * ทำงาน 2 โหมด:
 *   1) **ผูกเข้ากับโปรไฟล์เดิม (link)** — ถ้ามีคุกกี้เซสชันลูกค้าอยู่แล้ว จะผูก googleId เข้ากับแถวนั้น
 *      **โดยไม่สร้างแถวใหม่และไม่สลับเซสชัน** (ใช้ตอนกดปุ่ม "เชื่อม Gmail" ในหน้าโปรไฟล์สมาชิก)
 *      ถ้า googleId นั้นถูกผูกกับโปรไฟล์อื่นอยู่แล้ว → 409 (ยังไม่รวมบัญชีอัตโนมัติ)
 *   2) **ล็อกอินปกติ** — ไม่มีเซสชัน → หา/สร้าง User จาก googleId แล้วออกคุกกี้เซสชันเดิมของแอป
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const googleId = session?.user?.googleId

  if (!session || !googleId) {
    return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
  }

  const email = session.user?.email ?? null
  const name = session.user?.name ?? null
  const picture = session.user?.image ?? null

  try {
    // โหมดผูก: มีเซสชันลูกค้าอยู่แล้ว = ผู้ใช้กำลังเชื่อม Gmail เข้ากับโปรไฟล์ที่ล็อกอินอยู่
    const customer = getCustomerSession(request)
    if (customer) {
      const current = await db.user.findUnique({
        where: { id: customer.subject },
        select: { id: true, googleId: true, email: true, emailVerifiedAt: true },
      })

      if (current) {
        if (current.googleId && current.googleId !== googleId) {
          return NextResponse.json(
            { error: 'โปรไฟล์นี้ผูกบัญชี Google อื่นไว้แล้ว กรุณาติดต่อเจ้าหน้าที่' },
            { status: 409 }
          )
        }

        if (!current.googleId) {
          const owner = await db.user.findUnique({ where: { googleId }, select: { id: true } })
          if (owner && owner.id !== current.id) {
            return NextResponse.json(
              { error: 'บัญชี Google นี้ผูกกับโปรไฟล์อื่นอยู่แล้ว กรุณาติดต่อเจ้าหน้าที่' },
              { status: 409 }
            )
          }
        }

        const linked = await db.user.update({
          where: { id: current.id },
          data: {
            googleId,
            googleName: name,
            googlePictureUrl: picture,
            email: email ?? current.email,
            emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
          },
          select: { id: true, googleName: true, name: true, email: true, walletBalance: true },
        })

        // ไม่แตะคุกกี้เซสชัน — ผู้ใช้ยังเป็นเจ้าของโปรไฟล์เดิม
        return NextResponse.json({
          id: linked.id,
          name: linked.googleName ?? linked.name,
          email: linked.email,
          walletBalance: linked.walletBalance,
          linkedToExisting: true,
        })
      }
    }

    // โหมดล็อกอินปกติ (พฤติกรรมเดิม)
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
