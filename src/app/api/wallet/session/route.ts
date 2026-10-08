import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/session-auth'
import { ensureWalletCode, isLevelA } from '@/lib/member-level'

export async function GET(request: NextRequest) {
  const session = getCustomerSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.subject },
      select: {
        id: true,
        lineUserId: true,
        lineDisplayName: true,
        linePictureUrl: true,
        googleId: true,
        email: true,
        name: true,
        walletBalance: true,
        walletCode: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 })
    }
    // ระดับ A (ผูก LINE + Google ครบ หรือเป็นบัญชีที่ยกเว้น) = มี Wallet ID
    const levelA = isLevelA(user)
    const walletCode = await ensureWalletCode(user)
    // ส่งเท่าที่หน้าโปรไฟล์ใช้ — ไม่ส่ง lineUserId / googleId / email (รหัสช่องทาง/ข้อมูลติดต่อ)
    return NextResponse.json({
      id: user.id,
      name: user.name,
      lineDisplayName: user.lineDisplayName,
      linePictureUrl: user.linePictureUrl,
      walletBalance: user.walletBalance,
      walletCode,
      levelA,
      hasLine: Boolean(user.lineUserId),
      hasGoogle: Boolean(user.googleId),
    })
  } catch (error) {
    console.error('Failed to load wallet customer session', error)
    return NextResponse.json({ error: 'Failed to load customer profile' }, { status: 500 })
  }
}
