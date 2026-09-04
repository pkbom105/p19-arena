import { db } from '@/lib/db'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

/**
 * LINE Messaging API — ใช้สำหรับ "push" ข้อความเข้าแชทลูกค้า (เช่น ส่งตั๋วหลังจองสำเร็จ)
 * - Channel ID + Secret ของ Messaging API channel เก็บใน Settings (ตั้งผ่าน Dashboard → LINE Credential)
 * - Channel Access Token issue อัตโนมัติ (v2.1, ~30 วัน) และ auto-refresh ก่อนหมดอายุ
 */

const ISSUE_URL = 'https://api.line.me/v2.1/oauth/token'
const ISSUE_URL_LEGACY = 'https://api.line.me/v2/oauth/accessToken'
const REFRESH_URL = 'https://api.line.me/v2.1/oauth/accessToken'
const PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export const MESSAGING_KEYS = {
  channelId: 'line_messaging_channel_id',
  channelSecret: 'line_messaging_channel_secret',
  accessToken: 'line_messaging_access_token',
  refreshToken: 'line_messaging_refresh_token',
  expiresAt: 'line_messaging_token_expires_at',
} as const

const DAY_MS = 24 * 60 * 60 * 1000

async function readMessagingSettings(): Promise<Record<string, string>> {
  const rows = await db.settings.findMany({
    where: { key: { in: Object.values(MESSAGING_KEYS) } },
  })
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await db.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/** issue channel access token ใหม่จาก Channel ID + Secret แล้วบันทึกลง Settings */
export async function issueMessagingToken(
  channelId: string,
  channelSecret: string
): Promise<{ ok: true; expiresAt: string } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: channelId,
    client_secret: channelSecret,
  })
  let res: Response
  try {
    res = await fetch(ISSUE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (e) {
    return { ok: false, error: `เชื่อมต่อ api.line.me ไม่สำเร็จ: ${String(e)}` }
  }
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  // v2.1 ตอบไม่ผ่าน (บางเครือข่าย/edge 404) → fallback ไป legacy endpoint (ได้ token 30 วันเหมือนกัน แต่ไม่มี refresh_token)
  let accessToken = data.access_token
  let refreshToken = data.refresh_token ?? ''
  let expiresInSec = data.expires_in ?? 30 * 24 * 60 * 60
  if (!res.ok || !accessToken) {
    try {
      const res2 = await fetch(ISSUE_URL_LEGACY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      const data2 = (await res2.json().catch(() => ({}))) as {
        access_token?: string
        expires_in?: number
        error?: string
        error_description?: string
      }
      if (res2.ok && data2.access_token) {
        accessToken = data2.access_token
        refreshToken = ''
        expiresInSec = data2.expires_in ?? 30 * 24 * 60 * 60
      } else if (!data.access_token) {
        const msg = data2.error_description || data2.error || data.error_description || data.error
        return { ok: false, error: msg || `LINE API ตอบ HTTP ${res.status}/${res2.status}` }
      }
    } catch {
      if (!data.access_token) {
        return { ok: false, error: data.error_description || data.error || `LINE API ตอบ HTTP ${res.status}` }
      }
    }
  }
  if (!accessToken) {
    return { ok: false, error: data.error_description || data.error || 'LINE ไม่ส่ง access token กลับ' }
  }
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()
  await upsertSetting(MESSAGING_KEYS.channelId, channelId)
  await upsertSetting(MESSAGING_KEYS.channelSecret, channelSecret)
  await upsertSetting(MESSAGING_KEYS.accessToken, accessToken)
  await upsertSetting(MESSAGING_KEYS.refreshToken, refreshToken)
  await upsertSetting(MESSAGING_KEYS.expiresAt, expiresAt)
  return { ok: true, expiresAt }
}

/** ขอ token ใหม่ด้วย refresh_token (fallback กลับไป issue ใหม่ถ้า refresh ไม่ผ่าน) */
async function refreshOrReissueToken(): Promise<string | null> {
  const s = await readMessagingSettings()
  const id = s[MESSAGING_KEYS.channelId]
  const secret = s[MESSAGING_KEYS.channelSecret]
  if (!id || !secret) return null

  if (s[MESSAGING_KEYS.refreshToken]) {
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: s[MESSAGING_KEYS.refreshToken],
      })
      const res = await fetch(REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (res.ok) {
        const data = (await res.json()) as { access_token?: string; expires_in?: number }
        if (data.access_token) {
          const expiresInSec = data.expires_in ?? 30 * 24 * 60 * 60
          await upsertSetting(MESSAGING_KEYS.accessToken, data.access_token)
          await upsertSetting(
            MESSAGING_KEYS.expiresAt,
            new Date(Date.now() + expiresInSec * 1000).toISOString()
          )
          return data.access_token
        }
      }
    } catch {
      // refresh ไม่ผ่าน → ลอง issue ใหม่ด้านล่าง
    }
  }

  const re = await issueMessagingToken(id, secret)
  if (re.ok) {
    const s2 = await readMessagingSettings()
    return s2[MESSAGING_KEYS.accessToken] || null
  }
  return null
}

/** ได้ access token ที่ใช้งานได้ (ถ้ายังไม่ใกล้หมดอายุ ไม่ยุ่ง LINE) */
export async function getMessagingAccessToken(): Promise<string | null> {
  const s = await readMessagingSettings()
  if (!s[MESSAGING_KEYS.channelId] || !s[MESSAGING_KEYS.channelSecret]) return null
  const expiresAt = s[MESSAGING_KEYS.expiresAt] ? new Date(s[MESSAGING_KEYS.expiresAt]).getTime() : 0
  if (s[MESSAGING_KEYS.accessToken] && expiresAt - Date.now() > DAY_MS) {
    return s[MESSAGING_KEYS.accessToken]
  }
  return refreshOrReissueToken()
}

/** URL หน้า ticket สำหรับปุ่มในข้อความ */
export function ticketUrl(bookingId: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || 'https://p19arena.p19avenue.com'
  return `${site}/ticket/${bookingId}`
}

function flexRow(label: string, value: string) {
  return {
    type: 'box' as const,
    layout: 'baseline' as const,
    margin: 'md' as const,
    contents: [
      { type: 'text' as const, text: label, size: 'xs' as const, color: '#6b7280', flex: 4 },
      { type: 'text' as const, text: value, size: 'sm' as const, color: '#111827', align: 'end' as const, wrap: true, flex: 6 },
    ],
  }
}

/** ส่งตั๋ว (Flex Message) เข้าแชท LINE ของผู้จอง — ทำงานเฉพาะ user ที่ login ด้วย LINE + เป็นเพื่อน OA */
export async function sendTicketPush(bookingId: string): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { court: true, timeSlot: true, user: true },
    })
    if (!booking || !booking.user?.lineUserId) return

    const token = await getMessagingAccessToken()
    if (!token) {
      console.warn('[LINE push] ข้าม — ยังไม่ได้ตั้งค่า Messaging API (Dashboard → LINE Credential)')
      return
    }

    const dateTh = format(new Date(`${booking.bookingDate}T00:00:00`), 'd MMM yyyy', { locale: th })
    const code = booking.ticketCode ?? booking.id
    const flex = {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#059669',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '✅ จองสำเร็จ', weight: 'bold', size: 'lg', color: '#ffffff' },
          { type: 'text', text: 'P19 Pickleball Arena', size: 'xs', color: '#a7f3d0', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        contents: [
          flexRow('รหัสตั๋ว', code),
          flexRow('สนาม', booking.court?.name ?? '-'),
          flexRow('วันที่', dateTh),
          flexRow('เวลา', `${booking.timeSlot?.startTime ?? '-'} - ${booking.timeSlot?.endTime ?? '-'}`),
          flexRow('ผู้เล่น', booking.playerName),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#059669',
            action: { type: 'uri', label: 'เปิด Ticket', uri: ticketUrl(booking.id) },
          },
        ],
      },
    }

    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to: booking.user.lineUserId,
        messages: [{ type: 'flex', altText: `จองสำเร็จ! รหัสตั๋ว ${code}`, contents: flex }],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[LINE push] ส่งไม่สำเร็จ HTTP ${res.status}: ${text.slice(0, 300)}`)
    } else {
      console.log(`[LINE push] ส่งตั๋ว ${code} เข้าแชทสำเร็จ`)
    }
  } catch (e) {
    // push ต้องไม่ล้มการจอง — log เข้า error tracking เท่านั้น
    console.error('[LINE push] error:', e)
  }
}

