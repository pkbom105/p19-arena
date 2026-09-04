import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { issueMessagingToken, MESSAGING_KEYS } from '@/lib/line-messaging'

/** สถานะการเชื่อมต่อ Messaging API (Dashboard ใช้แสดง badge + วันหมดอายุ token) */
export async function GET() {
  try {
    const rows = await db.settings.findMany({
      where: { key: { in: Object.values(MESSAGING_KEYS) } },
    })
    const kv: Record<string, string> = {}
    for (const r of rows) kv[r.key] = r.value
    const connected = !!(kv[MESSAGING_KEYS.channelId] && kv[MESSAGING_KEYS.channelSecret] && kv[MESSAGING_KEYS.accessToken])
    return NextResponse.json({
      connected,
      channelId: connected ? kv[MESSAGING_KEYS.channelId] : '',
      tokenExpiresAt: connected ? kv[MESSAGING_KEYS.expiresAt] ?? null : null,
    })
  } catch (error) {
    console.error('Error fetching messaging status:', error)
    return NextResponse.json({ error: 'Failed to fetch messaging status' }, { status: 500 })
  }
}

/**
 * บันทึก Messaging API credentials + ทดสอบจริงกับ LINE (issue access token ทันที)
 * - channelSecret ไม่ได้ส่งมา (masked ********) → ใช้ค่าเดิมที่เก็บไว้ใน DB
 */
export async function POST(request: NextRequest) {
  try {
    const body: { channelId?: string; channelSecret?: string } = await request
      .json()
      .catch(() => ({}))

    const stored = await db.settings.findMany({
      where: { key: { in: [MESSAGING_KEYS.channelId, MESSAGING_KEYS.channelSecret] } },
    })
    const storedKv: Record<string, string> = {}
    for (const r of stored) storedKv[r.key] = r.value

    const channelId = (body.channelId ?? '').trim() || storedKv[MESSAGING_KEYS.channelId] || ''
    let channelSecret = (body.channelSecret ?? '').trim()
    if (!channelSecret || channelSecret === '********') {
      channelSecret = storedKv[MESSAGING_KEYS.channelSecret] || ''
    }

    if (!channelId || !channelSecret) {
      return NextResponse.json({ error: 'กรอก Channel ID และ Channel Secret ให้ครบ' }, { status: 400 })
    }

    const result = await issueMessagingToken(channelId, channelSecret)
    if (!result.ok) {
      return NextResponse.json(
        { error: `LINE ปฏิเสธ credentials — ${result.error}` },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true, tokenExpiresAt: result.expiresAt })
  } catch (error) {
    console.error('Error saving messaging credentials:', error)
    return NextResponse.json({ error: 'Failed to save messaging credentials' }, { status: 500 })
  }
}
