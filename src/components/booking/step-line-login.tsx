'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { absoluteUrl, apiUrl, lineRedirectUri, BASE_PATH } from '@/lib/api'
import { signIn } from 'next-auth/react'
import { useBookingStore } from '@/store/booking-store'

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'YOUR_CHANNEL_ID'
// redirect_uri ต้องตรง Callback URL ใน LINE console เป๊ะ + เหมือนกันทุกเครื่อง
// (ใช้ canonical URL จาก NEXT_PUBLIC_SITE_URL กันเครื่องที่เข้าทาง IP/host อื่นได้ redirect_uri เพี้ยน)
const LINE_LOGIN_REDIRECT_URI = lineRedirectUri()

/**
 * สร้าง state แบบ random — crypto.randomUUID มีเฉพาะ browser ใหม่ + secure context
 * เครื่องเก่า (iOS < 15.4, Chrome < 92, LINE in-app browser เก่า) จะ undefined
 * → กดปุ่มแล้วเงียบ (login ไม่ได้เฉพาะเครื่องเก่า) — ต้องมี fallback
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

export function StepLineLogin() {
  const { setStep, setLineUser, setLineLoginSkipped, setIsLoading, isLoading } = useBookingStore()

  // อ่าน Channel ID จาก Settings ใน DB (หน.ตั้งค่า) — fallback ไป value ที่ build ไว้ตอนนี้
  const [lineChannelId, setLineChannelId] = useState(LINE_CHANNEL_ID)

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/settings'), { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const id = (data && typeof data.line_channel_id === 'string' && data.line_channel_id.trim())
          ? data.line_channel_id.trim()
          : LINE_CHANNEL_ID
        setLineChannelId(id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handleLineLogin = useCallback(() => {
    setIsLoading(true)
    const state = makeState()
    // เก็บ state ไว้ทั้ง sessionStorage + localStorage — in-app browser (เปิดจากนักบรรทัด LINE)
    // และ browser โหมด private บางตัวล้าง sessionStorage ตอน redirect กลับมา → state หาย = login เงียบ
    sessionStorage.setItem('line_login_state', state)
    sessionStorage.setItem('line_login_intent', 'booking')
    try {
      localStorage.setItem('line_login_state', state)
      localStorage.setItem('line_login_intent', 'booking')
      localStorage.removeItem('line_login_return_to')
    } catch {
      // localStorage เต็ม/ถูกปิด — มี sessionStorage พอ
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: lineChannelId,
      redirect_uri: LINE_LOGIN_REDIRECT_URI,
      state,
      scope: 'profile openid',
      bot_prompt: 'normal',
    })

    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
  }, [setIsLoading, lineChannelId])

  const handleSkipLogin = async () => {
    setLineLoginSkipped(true)
    setStep(2)
  }

  /** เข้าสู่ระบบด้วย Google (next-auth) — กลับมาที่หน้าแรก แล้ว page.tsx จะ sync ผู้ใช้เข้ากระบวนการจอง */
  const handleGoogleLogin = () => {
    try {
      sessionStorage.setItem('google_login_intent', 'booking')
      localStorage.setItem('google_login_intent', 'booking')
    } catch {
      // storage ถูกปิด — ยัง login ได้ (แค่ไม่บันทึก intent)
    }
    void signIn('google', { callbackUrl: `${BASE_PATH}/` })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">เข้าสู่ระบบ</h2>
      </div>

      <Card className="border-emerald-200">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <MessageCircle className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">เข้าสู่ระบบ</h3>
            <p className="text-sm text-muted-foreground mt-2">
              เข้าสู่ระบบเพื่อยืนยันตัวตนและรับการแจ้งเตือนผ่าน LINE OA
              ของ P19 Pickleball Arena
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              variant="outline"
              className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium py-6 text-base"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <GoogleIcon className="h-5 w-5 mr-2" />
              เข้าสู่ระบบด้วย Google
            </Button>

            <Button
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-6 text-base"
              onClick={handleLineLogin}
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

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleSkipLogin}
            >
              จองโดยไม่ต้องเข้าสู่ระบบ
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            การเข้าสู่ระบบจะช่วยให้คุณสามารถดูประวัติการจองได้
            และรับการแจ้งเตือนเมื่อใกล้ถึงเวลาเล่น
          </p>
        </CardContent>
      </Card>
    </div>
  )
}