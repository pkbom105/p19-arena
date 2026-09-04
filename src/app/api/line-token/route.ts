import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'

interface LineIdTokenClaims {
  sub?: string
  name?: string
  picture?: string
}

function decodeIdTokenPayload(idToken: string): LineIdTokenClaims {
  try {
    const payload = idToken.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
  } catch {
    return {}
  }
}

/**
 * แลก authorization code เป็น id_token จริงกับ LINE (ฝั่ง server เท่านั้น)
 * ได้ LINE User ID จริง (sub) ที่คงที่ทุกครั้งของ login -> auto-fill ใช้ได้
 */
export async function POST(request: NextRequest) {
  try {
    const code = await request.json<{ code?: string; redirectUri?: string }>().catch(() => ({}))

    if (!code || !redirectUri) {
      return NextResponse.json({ error: 'code and redirectUri are required' }, { status: 400 })
    }

    // อ่าน LINE ข้อมูลจาก Settings ใน DB (ตั้งในหน.ตั้งค่า) — fallback ไป env
    let lineChannelId = process.env.LINE_CHANNEL_ID || process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || ''
    let lineChannelSecret = process.env.LINE_CHANNEL_SECRET || ''

    try {
      const rows = await db.settings.findMany({
        where: { key: { in: ['line_channel_id', 'line_channel_secret'] } },
      })
      for (const row of rows) {
        if (row.key === 'line_channel_id' && row.value.trim()) lineChannelId = row.value.trim()
        if (row.key === 'line_channel_secret' && row.value.trim()) lineChannelSecret = row.value.trim()
      }
    } catch (e) {
      console.error('[LINE] settings lookup failed:', e)
    }

    if (!lineChannelId || !lineChannelSecret) {
      console.error('LINE credentials missing: set LINE_CHANNEL_SECRET (env) หรือ line_channel_secret ในหน้าตั้งค่า')
      return NextResponse.json({ error: 'LINE credentials are not configured' }, { status: 500 })
    }

    const tokenRes = await fetch(LINE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: lineChannelId,
        client_secret: lineChannelSecret,
      }).toString(),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.id_token) {
      console.error('LINE token exchange failed:', tokenData)
      return NextResponse.json(
        { error: tokenData.error_description || tokenData.error || 'LINE token exchange failed' },
        { status: 401 }
      )
    }

    const claims = decodeIdTokenPayload(tokenData.id_token)
    const lineUserId = claims.sub

    if (!lineUserId) {
      return NextResponse.json({ error: 'Invalid LINE id_token' }, { status: 401 })
    }

    // Upsert user ด้วย LINE User ID จริง (record เดิม = ข้อมูลเก่า = auto-fill ได้)
    let user = await db.user.findUnique({ where: { lineUserId } })

    if (!user) {
      user = await db.user.create({
        data: {
          lineUserId,
          lineDisplayName: claims.name || null,
          linePictureUrl: claims.picture || null,
          name: claims.name || null,
        },
      })
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          lineDisplayName: claims.name || user.lineDisplayName,
          linePictureUrl: claims.picture || user.linePictureUrl,
        },
      })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error in LINE token exchange:', error)
    return NextResponse.json({ error: 'LINE token exchange failed' }, { status: 500 })
  }
}