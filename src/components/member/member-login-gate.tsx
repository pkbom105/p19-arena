'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiUrl, BASE_PATH, lineRedirectUri } from '@/lib/api'

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'YOUR_CHANNEL_ID'

/** หน้าที่เริ่มล็อกอินไว้ — LINE redirect กลับมาที่หน้าแรก แล้วหน้าแรกจะพากลับมาที่นี่ */
const RETURN_TO = `${BASE_PATH}/member`

/**
 * สร้าง state แบบ random — crypto.randomUUID มีเฉพาะ browser ใหม่ + secure context
 * เครื่องเก่า (iOS < 15.4, Chrome < 92, LINE in-app browser เก่า) จะ undefined
 * → กดปุ่มแล้วเงียบ จึงต้องมี fallback (แบบเดียวกับหน้า login ของการจอง)
 */
function makeState(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** โลโก้ Google (ตามแบรนด์ไกด์ของ Google) — ใช้ในปุ่ม "เข้าสู่ระบบด้วย Google" */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

/**
 * บล็อกเข้าสู่ระบบของพื้นที่สมาชิก — แสดง **ก่อน** เนื้อหาทุกครั้ง
 * - ยังไม่ล็อกอิน (401 จาก /api/wallet/session) → โชว์ปุ่ม Google / LINE และไม่แสดง children
 * - ล็อกอินแล้ว → แสดง children ตามปกติ
 * - กลับจาก Google (next-auth) → สะพานไปคุกกี้เซสชันเดิมของแอป (p19_customer_session) แล้วรีเฟรช
 */
export function MemberLoginGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [lineChannelId, setLineChannelId] = useState(LINE_CHANNEL_ID)
  const [isLoading, setIsLoading] = useState(false)

  /** ตรวจเซสชันที่ล็อกอินอยู่ + อ่าน LINE Channel ID จาก settings (แบบเดียวกับหน้าลูกค้า Top up) */
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [sessionRes, settingsRes] = await Promise.all([
          fetch(apiUrl('/api/wallet/session'), { cache: 'no-store' }),
          fetch(apiUrl('/api/settings'), { cache: 'no-store' }),
        ])

        if (settingsRes.ok) {
          const settings: unknown = await settingsRes.json()
          if (
            typeof settings === 'object' &&
            settings !== null &&
            'line_channel_id' in settings &&
            typeof settings.line_channel_id === 'string' &&
            settings.line_channel_id.trim()
          ) {
            if (!cancelled) setLineChannelId(settings.line_channel_id.trim())
          }
        }

        if (!cancelled) setAuthenticated(sessionRes.ok)
      } catch (error) {
        console.error('Failed to check member session', error)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  /** กลับจาก Google (next-auth) → ออกคุกกี้เซสชันของแอป แล้วโหลดหน้าใหม่ให้ gate ผ่าน */
  useEffect(() => {
    if (checking || authenticated) return
    let cancelled = false
    const syncGoogleSession = async () => {
      try {
        const googleSession = await getSession()
        if (!googleSession?.user?.googleId) return
        const response = await fetch(apiUrl('/api/auth/google/sync'), { method: 'POST' })
        if (!cancelled && response.ok) window.location.reload()
      } catch (error) {
        console.error('Failed to bridge Google session', error)
      }
    }

    void syncGoogleSession()
    return () => { cancelled = true }
  }, [authenticated, checking])

  /** เริ่มล็อกอิน Google — กลับมาที่ /member แล้ว gate จะ sync เซสชันให้เอง */
  const startGoogleLogin = useCallback(() => {
    setIsLoading(true)
    void signIn('google', { callbackUrl: RETURN_TO })
  }, [])

  /** เริ่มล็อกอิน LINE — จำ intent/return_to ไว้ให้หน้าแรกพากลับมาที่ /member หลังแลก code สำเร็จ */
  const startLineLogin = useCallback(() => {
    setIsLoading(true)
    const state = makeState()
    // เก็บทั้ง sessionStorage + localStorage — browser บางตัว (in-app/private) ล้าง sessionStorage ตอน redirect
    try {
      sessionStorage.setItem('line_login_state', state)
      sessionStorage.setItem('line_login_intent', 'member')
      sessionStorage.setItem('line_login_return_to', RETURN_TO)
      localStorage.setItem('line_login_state', state)
      localStorage.setItem('line_login_intent', 'member')
      localStorage.setItem('line_login_return_to', RETURN_TO)
    } catch (storageError) {
      console.error('Unable to persist LINE login state', storageError)
      setIsLoading(false)
      return
    }

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

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (authenticated) return <>{children}</>

  return (
    <Card className="border-emerald-200">
      <CardContent className="p-6 text-center space-y-5">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <LockKeyhole className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">เข้าสู่ระบบก่อนใช้งาน</h2>
          <p className="text-sm text-muted-foreground mt-2">
            เนื้อหาด้านล่างจะแสดงหลังเข้าสู่ระบบด้วย Google (Gmail) หรือ LINE
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <Button
            variant="outline"
            className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium py-6 text-base"
            onClick={startGoogleLogin}
            disabled={isLoading}
          >
            <GoogleIcon className="h-5 w-5 mr-2" />
            เข้าสู่ระบบด้วย Google
          </Button>

          <Button
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-6 text-base"
            onClick={startLineLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 5.8 2 10.4c0 2.8 1.5 5.3 3.8 7l-1 3.6 4.2-2.2c1 .3 2 .4 3 .4 5.5 0 10-3.8 10-8.4S17.5 2 12 2z" />
              </svg>
            )}
            เข้าสู่ระบบด้วย LINE
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
