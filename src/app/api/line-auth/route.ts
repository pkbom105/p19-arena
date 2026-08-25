import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lineUserId, lineDisplayName, linePictureUrl } = body

    if (!lineUserId) {
      return NextResponse.json({ error: 'LINE User ID is required' }, { status: 400 })
    }

    let user = await db.user.findUnique({
      where: { lineUserId },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          lineUserId,
          lineDisplayName: lineDisplayName || null,
          linePictureUrl: linePictureUrl || null,
          name: lineDisplayName || null,
        },
      })
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          lineDisplayName: lineDisplayName || user.lineDisplayName,
          linePictureUrl: linePictureUrl || user.linePictureUrl,
        },
      })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error in LINE auth:', error)
    return NextResponse.json({ error: 'LINE auth failed' }, { status: 500 })
  }
}
