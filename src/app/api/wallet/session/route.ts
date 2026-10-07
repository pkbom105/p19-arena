import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/session-auth'

export async function GET(request: NextRequest) {
  const session = getCustomerSession(request)
  if (!session) {
    return NextResponse.json({ error: 'LINE login required' }, { status: 401 })
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.subject },
      select: {
        id: true,
        lineDisplayName: true,
        linePictureUrl: true,
        name: true,
        walletBalance: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to load wallet customer session', error)
    return NextResponse.json({ error: 'Failed to load customer profile' }, { status: 500 })
  }
}
