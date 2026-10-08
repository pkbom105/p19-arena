import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { CUSTOMER_SESSION_COOKIE, getCustomerSession, setSessionCookie } from '@/lib/session-auth'

const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

interface LineIdTokenClaims {
  sub?: string
  name?: string
  picture?: string
}

/**
 * แลก authorization code เป็น id_token จริงกับ LINE (ฝั่ง server เท่านั้น)
 * ได้ LINE User ID จริง (sub) ที่คงที่ทุกครั้งของ login -> auto-fill ใช้ได้
 */
export async function POST(request: NextRequest) {
  try {
    const body: { code?: string; redirectUri?: string; purpose?: string } = await request.json().catch(() => ({}))
    const code = body.code ?? ''
    const redirectUri = body.redirectUri ?? ''

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

    const verifyRes = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: tokenData.id_token,
        client_id: lineChannelId,
      }).toString(),
    })
    const verifiedClaims: unknown = await verifyRes.json()
    if (!verifyRes.ok || typeof verifiedClaims !== 'object' || verifiedClaims === null) {
      console.error('LINE ID token verification failed:', verifiedClaims)
      return NextResponse.json({ error: 'LINE ID token verification failed' }, { status: 401 })
    }
    const claims = verifiedClaims as LineIdTokenClaims
    const lineUserId = claims.sub

    if (!lineUserId) {
      return NextResponse.json({ error: 'Invalid LINE id_token' }, { status: 401 })
    }

    // โหมดผูกบัญชี (purpose: 'link') — ผู้ใช้ที่ล็อกอินอยู่กดปุ่ม "เชื่อม LINE" ในหน้าโปรไฟล์สมาชิก
    // ต้องผูก lineUserId เข้ากับ "แถวเดิม" และ **ไม่สลับเซสชัน** (พฤติกรรมเดิม = สลับเซสชัน ใช้เฉพาะล็อกอินปกติ)
    if (body.purpose === 'link') {
      const customer = getCustomerSession(request)
      if (customer) {
        const current = await db.user.findUnique({
          where: { id: customer.subject },
          select: { id: true, lineUserId: true },
        })

        if (current) {
          if (current.lineUserId && current.lineUserId !== lineUserId) {
            return NextResponse.json(
              { error: 'โปรไฟล์นี้ผูกบัญชี LINE อื่นไว้แล้ว กรุณาติดต่อเจ้าหน้าที่' },
              { status: 409 }
            )
          }

          if (!current.lineUserId) {
            const owner = await db.user.findUnique({ where: { lineUserId }, select: { id: true } })
            if (owner && owner.id !== current.id) {
              return NextResponse.json(
                { error: 'บัญชี LINE นี้ผูกกับโปรไฟล์อื่นอยู่แล้ว กรุณาติดต่อเจ้าหน้าที่' },
                { status: 409 }
              )
            }
          }

          const linked = await db.user.update({
            where: { id: current.id },
            data: {
              lineUserId,
              lineDisplayName: claims.name || null,
              linePictureUrl: claims.picture || null,
            },
          })
          // ไม่แตะคุกกี้เซสชัน — คืนโปรไฟล์เดิม (ที่ผูก LINE แล้ว) ให้หน้าโปรไฟล์โหลดใหม่
          return NextResponse.json(linked)
        }
      }
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

    const response = NextResponse.json(user)
    // ออกเซสชันลูกค้าให้ทุกการ login (ทั้งจองและเติมเงิน) — หน้าแรกจะได้จำสถานะ ไม่ต้องล็อกอินซ้ำ
    setSessionCookie(response, CUSTOMER_SESSION_COOKIE, user.id)
    return response
  } catch (error) {
    console.error('Error in LINE token exchange:', error)
    return NextResponse.json({ error: 'LINE token exchange failed' }, { status: 500 })
  }
}