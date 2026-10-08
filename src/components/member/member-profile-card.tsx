'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSession, signIn } from 'next-auth/react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TopupCardsPanel } from '@/components/dashboard/topup-cards-panel'
import { apiUrl, BASE_PATH, lineRedirectUri } from '@/lib/api'
import { cn } from '@/lib/utils'

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'YOUR_CHANNEL_ID'
/** ปลายทางกลับหลังผูกช่องทางสำเร็จ — กลับมาที่แท็บ "ผู้ใช้" ซึ่งมีปุ่มเชื่อม */
const USER_PAGE_PATH = `${BASE_PATH}/member/profile/user`
/** ธงชั่วคราว: เพิ่งกลับจากหน้า Google เพื่อ "ผูก" (ไม่ใช่ล็อกอินใหม่) */
const GOOGLE_LINK_FLAG = 'p19_link_google_pending'
/** ที่พักข้อความ error ที่ส่งกลับมาจากหน้าแรก (กรณีผูก LINE ไม่สำเร็จ) */
const LINK_ERROR_KEY = 'p19_link_error'

/** โปรไฟล์ของลูกค้าที่ล็อกอินอยู่ — รูปร่างข้อมูลเดียวกับ GET /api/wallet/session */
interface MemberProfile {
  id: string
  name: string | null
  lineDisplayName: string | null
  linePictureUrl: string | null
  walletBalance: number
  /** รหัสกระเป๋า — มีเมื่อเป็นสมาชิกระดับ A (ผูก LINE + Google ครบ) */
  walletCode: string | null
  /** ระดับ A = ผูกทั้ง LINE และ Google (หรือเป็นบัญชีที่ยกเว้นไว้) */
  levelA: boolean
  /** ผูก LINE ไว้แล้วหรือยัง */
  hasLine: boolean
  /** ผูก Google (Gmail) ไว้แล้วหรือยัง */
  hasGoogle: boolean
}

/** จัดรูปแบบจำนวนเงิน (บาท) — แบบเดียวกับหน้าลูกค้า Top up */
const formatBaht = (value: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)

/** state แบบ random สำหรับ LINE OAuth (browser เก่าไม่มี crypto.randomUUID) */
function makeState(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** แถวช่องทางเข้าสู่ระบบ — ผูกแล้ว = ป้ายเขียว · ยังไม่ผูก = ปุ่ม "เชื่อม" ที่กดได้จริง */
function ChannelRow({
  icon: Icon,
  label,
  connected,
  busy,
  onConnect,
  connectLabel,
}: {
  icon: LucideIcon
  label: string
  connected: boolean
  busy: boolean
  onConnect: () => void
  connectLabel: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <span className={cn('flex items-center gap-2 text-sm', connected ? 'text-foreground' : 'text-muted-foreground')}>
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {connected ? (
        <Badge variant="secondary" className="gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          เชื่อมแล้ว
        </Badge>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onConnect}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : connectLabel}
        </Button>
      )}
    </div>
  )
}

/**
 * ดึงโปรไฟล์สมาชิกจาก GET /api/wallet/session
 * ใช้ร่วมกันทั้งแผง "กระเป๋าเงิน" และแผง "ผู้ใช้" (ทุกการล็อกอินออกคุกกี้เซสชันเดียวกัน)
 */
function useMemberProfile() {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** เพิ่มค่าเพื่อสั่งโหลดใหม่ — เช่นหลังเติมเงินสำเร็จ ต้องอัปเดตยอดกระเป๋าในจอทันที */
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/wallet/session'), { cache: 'no-store' })
        if (!response.ok) throw new Error(`Unable to load member profile (${response.status})`)
        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('id' in result) ||
          typeof result.id !== 'string' ||
          !('walletBalance' in result) ||
          typeof result.walletBalance !== 'number'
        ) {
          throw new Error('Invalid member profile response')
        }
        if (!cancelled) {
          const data = result as Omit<MemberProfile, 'hasLine' | 'hasGoogle' | 'walletCode' | 'levelA'>
          setProfile({
            ...data,
            walletCode: 'walletCode' in result && typeof result.walletCode === 'string' ? result.walletCode : null,
            levelA: 'levelA' in result && result.levelA === true,
            hasLine: 'hasLine' in result && result.hasLine === true,
            hasGoogle: 'hasGoogle' in result && result.hasGoogle === true,
          })
        }
      } catch (loadError) {
        console.error('Failed to load member profile', loadError)
        if (!cancelled) setError('โหลดโปรไฟล์ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [reloadKey])

  return { profile, loading, error, reload }
}

/** แผง "กระเป๋าเงิน" — ยอดเงิน + Wallet ID + เติมเงินด้วย Cash Card (การ์ดเดิมจากหน้า /dashboard/1/topup) */
export function MemberWalletPanel() {
  const { profile, loading, error, reload } = useMemberProfile()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  /**
   * ยืนยันสลิปจากแผง Cash Card → ส่งเข้าประตูฝั่งเซิร์ฟเวอร์ (`/api/wallet/cash-card`)
   * เซิร์ฟเวอร์เป็นผู้ตรวจสลิปซ้ำ + คิดยอดจาก "การ์ด" + ตัดสินว่าจะเครดิตทันทีหรือรอตรวจ
   */
  const confirmCashCard = useCallback(
    async (info: { cardId: string; slipName: string; slipDataUrl: string }) => {
      setNotice(null)
      try {
        const response = await fetch(apiUrl('/api/wallet/cash-card'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId: info.cardId, slipName: info.slipName, slipDataUrl: info.slipDataUrl }),
        })
        const result: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const failure = result as { error?: string } | null
          const message = failure?.error ?? 'บันทึกสลิปไม่สำเร็จ กรุณาลองใหม่'
          setNotice({ ok: false, text: message })
          return { ok: false, error: message }
        }
        const data = result as { credited?: boolean; amount?: number; message?: string } | null
        const credited = data?.credited === true
        setNotice({
          ok: credited,
          text: data?.message ?? (credited ? 'เติมเงินสำเร็จ' : 'ได้รับสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ'),
        })
        // เครดิตสำเร็จ → โหลดยอดกระเป๋าใหม่ทันที (หน้า wallet อัปเดตเอง)
        if (credited) reload()
        return { ok: true }
      } catch (submitError) {
        console.error('Failed to submit cash card top-up', submitError)
        const message = 'บันทึกสลิปไม่สำเร็จ กรุณาลองใหม่'
        setNotice({ ok: false, text: message })
        return { ok: false, error: message }
      }
    },
    [reload]
  )

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error ?? 'ไม่พบข้อมูลโปรไฟล์'}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 pt-6">
        {/* กระเป๋าเงิน */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm text-emerald-800">
            <Wallet className="h-4 w-4" />
            กระเป๋าเงิน
          </span>
          <span className="text-lg font-bold text-emerald-700">{formatBaht(profile.walletBalance)}</span>
        </div>

        {/* Wallet ID — ออกให้เมื่อเป็นสมาชิกระดับ A (ผูก LINE + Google ครบทั้งคู่) */}
        {profile.walletCode ? (
          <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-emerald-800">
                <Sparkles className="h-4 w-4" />
                Wallet ID
              </span>
              <span className="font-mono text-sm font-bold tracking-wide text-emerald-700">{profile.walletCode}</span>
            </div>
            <p className="text-xs text-emerald-700">สมาชิกระดับ A — ใช้โปรโมชัน/ส่วนลดพิเศษได้</p>
          </div>
        ) : (
          <div className="space-y-1 rounded-lg border border-dashed px-3 py-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              ยังไม่มี Wallet ID
            </p>
            <p className="text-xs text-muted-foreground">
              โน้ต: เมื่อเชื่อม LINE และ Gmail ครบทั้งคู่ จะได้รับ Wallet ID และใช้โปรโมชัน/ส่วนลดพิเศษได้
            </p>
          </div>
        )}

        {/* ข้อความผลการเติมเงิน (สำเร็จ = เขียว · รอตรวจ/ไม่ผ่าน = แดง) */}
        {notice && (
          <div
            className={
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ' +
              (notice.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700')
            }
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice.text}</span>
          </div>
        )}

        {/* เติมเงินด้วย Cash Card — แผงเดิมจากหน้า /dashboard/1/topup (โหมดสมาชิก: ไม่ต้องเลือกลูกค้า) */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <h2 className="text-base font-bold">เติมเงินด้วย Cash Card</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              เลือกบัตร → สแกน QR พร้อมเพย์ → อัปโหลดสลิปเพื่อยืนยัน (ระบบตรวจสลิปให้อัตโนมัติ)
            </p>
          </div>
          <TopupCardsPanel mode="member" selfUserId={profile.id} onConfirmed={confirmCashCard} />
        </div>
      </CardContent>
    </Card>
  )
}

/** แผง "ผู้ใช้" — ชื่อ/รูป + ช่องทางเข้าสู่ระบบ (ปุ่มเชื่อม LINE / Gmail) */
export function MemberUserPanel() {
  const { profile, loading, error } = useMemberProfile()
  const [message, setMessage] = useState<string | null>(null)
  const [busyChannel, setBusyChannel] = useState<'line' | 'google' | null>(null)
  const [lineChannelId, setLineChannelId] = useState(LINE_CHANNEL_ID)

  // ข้อความแจ้งเตือนที่หน้าแรกฝากไว้ (เช่น ผูก LINE ไม่สำเร็จเพราะช่องทางถูกใช้กับโปรไฟล์อื่น)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LINK_ERROR_KEY)
      if (stored) {
        setMessage(stored)
        sessionStorage.removeItem(LINK_ERROR_KEY)
      }
    } catch {
      // sessionStorage ถูกปิด/เต็ม — ข้ามได้
    }
  }, [])

  // อ่าน LINE Channel ID จาก settings (แบบเดียวกับหน้า login ของพื้นที่สมาชิก)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/settings'), { cache: 'no-store' })
        if (!response.ok) return
        const settings: unknown = await response.json()
        if (
          !cancelled &&
          typeof settings === 'object' &&
          settings !== null &&
          'line_channel_id' in settings &&
          typeof settings.line_channel_id === 'string' &&
          settings.line_channel_id.trim()
        ) {
          setLineChannelId(settings.line_channel_id.trim())
        }
      } catch (settingsError) {
        console.error('Failed to load LINE channel id', settingsError)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  /**
   * หลังกลับจากหน้า Google: ถ้าเคยกดปุ่ม "เชื่อม Gmail" → ผูก googleId เข้ากับโปรไฟล์เดิม
   * (API ฝั่งเซิร์ฟเวอร์ตรวจให้ว่า googleId ไม่ได้ถูกใช้กับโปรไฟล์อื่น — ถ้าซ้ำจะตอบ 409 + ข้อความ)
   */
  useEffect(() => {
    if (loading || !profile || profile.hasGoogle) return

    let pending = false
    try {
      pending = sessionStorage.getItem(GOOGLE_LINK_FLAG) === '1'
    } catch {
      pending = false
    }
    if (!pending) return

    let cancelled = false
    const link = async () => {
      setBusyChannel('google')
      try {
        const googleSession = await getSession()
        const googleId = (googleSession?.user as { googleId?: string } | undefined)?.googleId
        try {
          sessionStorage.removeItem(GOOGLE_LINK_FLAG)
        } catch {
          // ignore
        }
        if (!googleId) return // ยังไม่ได้ล็อกอิน Google (ผู้ใช้อาจกดยกเลิก)

        const response = await fetch(apiUrl('/api/auth/google/sync'), { method: 'POST' })
        const result: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const failure = result as { error?: string } | null
          if (!cancelled) setMessage(failure?.error ?? 'เชื่อม Gmail ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
          return
        }
        if (!cancelled) window.location.reload()
      } catch (linkError) {
        console.error('Failed to link Google account', linkError)
        if (!cancelled) setMessage('เชื่อม Gmail ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      } finally {
        if (!cancelled) setBusyChannel(null)
      }
    }

    void link()
    return () => { cancelled = true }
  }, [loading, profile])

  /** เริ่มผูก Gmail — กลับมาที่หน้านี้แล้ว effect ด้านบนจะผูกบัญชีให้เอง */
  const startGoogleLink = useCallback(() => {
    setMessage(null)
    try {
      sessionStorage.setItem(GOOGLE_LINK_FLAG, '1')
    } catch {
      // เก็บธงไม่ได้ก็ยังล็อกอินได้ เพียงแต่ไม่ผูกอัตโนมัติ
    }
    setBusyChannel('google')
    void signIn('google', { callbackUrl: USER_PAGE_PATH })
  }, [])

  /** เริ่มผูก LINE — จำ intent 'link' + ปลายทางไว้ให้หน้าแรกพากลับมาที่นี่หลังแลก code */
  const startLineLink = useCallback(() => {
    setMessage(null)
    const state = makeState()
    try {
      sessionStorage.setItem('line_login_state', state)
      sessionStorage.setItem('line_login_intent', 'link')
      sessionStorage.setItem('line_login_return_to', USER_PAGE_PATH)
      localStorage.setItem('line_login_state', state)
      localStorage.setItem('line_login_intent', 'link')
      localStorage.setItem('line_login_return_to', USER_PAGE_PATH)
    } catch (storageError) {
      console.error('Unable to persist LINE link state', storageError)
      setMessage('เครื่องนี้ปิดที่จัดเก็บข้อมูลชั่วคราวไว้ จึงเชื่อม LINE ไม่ได้')
      return
    }

    setBusyChannel('line')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: lineChannelId,
      redirect_uri: lineRedirectUri(),
      state,
      scope: 'profile openid',
      bot_prompt: 'normal',
    })
    window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`)
  }, [lineChannelId])

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error ?? 'ไม่พบข้อมูลโปรไฟล์'}
        </CardContent>
      </Card>
    )
  }

  const displayName = profile.name || profile.lineDisplayName || 'สมาชิก'
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 pt-6">
        {/* โปรไฟล์ — แสดงชื่อที่เข้าสู่ระบบ */}
        <div className="flex items-center gap-3">
          {profile.linePictureUrl ? (
            <img
              src={profile.linePictureUrl}
              alt={displayName}
              className="h-14 w-14 rounded-full object-cover border shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-semibold shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold truncate text-base">{displayName}</p>
            <p className="text-xs text-muted-foreground">โปรไฟล์สมาชิก</p>
          </div>
        </div>

        {/* ข้อความแจ้งเตือน (เช่น ผูกช่องทางไม่สำเร็จ) */}
        {message && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* ช่องทางเข้าสู่ระบบ — ผูกแล้วขึ้นป้าย · ยังไม่ผูกมีปุ่มให้เชื่อม */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">ช่องทางเข้าสู่ระบบ</p>
          <ChannelRow
            icon={MessageCircle}
            label="LINE"
            connected={profile.hasLine}
            busy={busyChannel === 'line'}
            onConnect={startLineLink}
            connectLabel="เชื่อม LINE"
          />
          <ChannelRow
            icon={Mail}
            label="Google (Gmail)"
            connected={profile.hasGoogle}
            busy={busyChannel === 'google'}
            onConnect={startGoogleLink}
            connectLabel="เชื่อม Gmail"
          />
        </div>
      </CardContent>
    </Card>
  )
}
