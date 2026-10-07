'use client'

import { apiUrl, BASE_PATH, lineRedirectUri } from '@/lib/api'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MapPin } from 'lucide-react'
import { getSession } from 'next-auth/react'
import { SiteHeader } from '@/components/site-header'
import { StepperHeader } from '@/components/booking/stepper-header'
import { StepLineLogin } from '@/components/booking/step-line-login'
import { StepGrid } from '@/components/booking/step-grid'
import { StepSummary } from '@/components/booking/step-summary'
import { StepConfirm } from '@/components/booking/step-confirm'
import { useBookingStore } from '@/store/booking-store'
import type { BookingItem, RentalItem } from '@/store/booking-store'

export default function BookingPage() {
  const { step, setLineUser, setStep, setIsLoading, setRentalSelections } = useBookingStore()
  const [mounted, setMounted] = useState(false)

  async function handleLineCallback(code: string) {
    setIsLoading(true)
    try {
      const loginIntent =
        sessionStorage.getItem('line_login_intent') || localStorage.getItem('line_login_intent')
      const returnTo =
        sessionStorage.getItem('line_login_return_to') || localStorage.getItem('line_login_return_to')
      // แลก code เป็น LINE User ID จริง (server-side) -> user record เดิม -> auto-fill ได้
      const res = await fetch(apiUrl('/api/line-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          purpose: loginIntent === 'topup' ? 'topup' : 'booking',
          // ต้องตรงกับ Callback URL ที่ลงทะเบียนใน LINE console เป๊ะ และเหมือนกันทุกเครื่อง
          redirectUri: lineRedirectUri(),
        }),
      })

      const user = await res.json()

      if (res.ok && user && user.id) {
        setLineUser(user)
        if (
          loginIntent === 'topup' &&
          returnTo === `${BASE_PATH}/account/topup`
        ) {
          sessionStorage.removeItem('line_login_return_to')
          sessionStorage.removeItem('line_login_state')
          sessionStorage.removeItem('line_login_intent')
          try {
            localStorage.removeItem('line_login_state')
            localStorage.removeItem('line_login_return_to')
            localStorage.removeItem('line_login_intent')
          } catch {
            // ignore
          }
          window.location.assign(returnTo)
          return
        }
      } else {
        console.error('LINE auth error:', user?.error || res.status)
        // code ใช้ซ้ำ/หมดอายุ (กด refresh ตอนหน้า callback) = invalid_grant — ให้ลอง login ใหม่
        toast.error(user?.error || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณากดเข้าสู่ระบบอีกครั้ง')
        if (
          loginIntent === 'topup' &&
          returnTo === `${BASE_PATH}/account/topup`
        ) {
          sessionStorage.removeItem('line_login_return_to')
          sessionStorage.removeItem('line_login_state')
          sessionStorage.removeItem('line_login_intent')
          try {
            localStorage.removeItem('line_login_state')
            localStorage.removeItem('line_login_return_to')
            localStorage.removeItem('line_login_intent')
          } catch {
            // ignore
          }
          window.location.assign(returnTo)
          return
        }
      }

      setStep(2)
      sessionStorage.removeItem('line_login_state')
      sessionStorage.removeItem('line_login_intent')
      try {
        localStorage.removeItem('line_login_state')
        localStorage.removeItem('line_login_intent')
        localStorage.removeItem('line_login_return_to')
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('LINE auth error:', err)
      toast.error('เชื่อมต่อ LINE ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่')
      setStep(2)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const mountFrame = window.requestAnimationFrame(() => setMounted(true))

    // Seed data on first load
    fetch(apiUrl('/api/seed'), { method: 'POST' }).catch(() => {})

    // Restore bookingItems from sessionStorage (after LINE login redirect)
    const savedItems = sessionStorage.getItem('booking_items')
    const savedForm = sessionStorage.getItem('booking_form')
    const returnStep = sessionStorage.getItem('booking_return_step')
    const savedRentals = sessionStorage.getItem('rental_selections')

    if (savedItems) {
      try {
        const items: BookingItem[] = JSON.parse(savedItems)
        useBookingStore.setState({ bookingItems: items })
        sessionStorage.removeItem('booking_items')
      } catch {
        // ignore parse errors
      }
    }
    if (savedForm) {
      try {
        const form = JSON.parse(savedForm)
        useBookingStore.getState().setBookingForm(form)
        sessionStorage.removeItem('booking_form')
      } catch {
        // ignore
      }
    }
    if (savedRentals) {
      try {
        const rentals: RentalItem[] = JSON.parse(savedRentals)
        setRentalSelections(rentals)
        sessionStorage.removeItem('rental_selections')
      } catch {
        // ignore
      }
    }
    if (returnStep) {
      sessionStorage.removeItem('booking_return_step')
    }

    // Handle LINE Login callback
    const params = new URLSearchParams(window.location.search)

    // มาจากหน้า /activity/coach (จองโค้ช) — จำรหัสโค้ชไว้ข้าม LINE redirect
    // (หลัง login สำเร็จ URL ถูก replaceState เป็น '/' → query หาย ถ้าไม่เก็บไว้)
    const coachParam = params.get('coach')
    if (coachParam) {
      try {
        sessionStorage.setItem('coach_id', coachParam)
      } catch {
        // sessionStorage ถูกปิด — จองสนามต่อได้ปกติ แค่ไม่มีโค้ชต่อท้าย
      }
    }

    const code = params.get('code')
    const state = params.get('state')

    // LINE ส่ง error กลับมาทาง query (เช่น error=access_denied) — แจ้งผู้ใช้แทนการเงียบ
    const oauthError = params.get('error')

    // อ่าน step จาก URL (?step=N) — refresh/แชร์ลิงก์แล้วอยู่ step เดิม
    const stepParam = Number(params.get('step'))
    if (Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= 4) {
      setStep(stepParam)
    }

    if (oauthError) {
      toast.error(`LINE Login ไม่สำเร็จ: ${params.get('error_description') || oauthError}`)
      const returnTo =
        sessionStorage.getItem('line_login_return_to') || localStorage.getItem('line_login_return_to')
      window.history.replaceState({}, '', `${BASE_PATH}/`)
      if (returnTo === `${BASE_PATH}/account/topup`) {
        sessionStorage.removeItem('line_login_return_to')
        sessionStorage.removeItem('line_login_state')
        sessionStorage.removeItem('line_login_intent')
        try {
          localStorage.removeItem('line_login_return_to')
          localStorage.removeItem('line_login_state')
          localStorage.removeItem('line_login_intent')
        } catch {
          // ignore
        }
        window.location.assign(returnTo)
      }
      return
    }

    if (code && state) {
      // state เก็บไว้ทั้ง 2 ที่ (sessionStorage + localStorage) — เผื่อ browser ที่ล้าง sessionStorage ตอน redirect
      const savedState =
        sessionStorage.getItem('line_login_state') || localStorage.getItem('line_login_state')

      if (savedState === state) {
        handleLineCallback(code)
        window.history.replaceState({}, '', `${BASE_PATH}/`)
      }
    }
    return () => window.cancelAnimationFrame(mountFrame)
  }, [])

  // กลับจาก Google (next-auth) → sync ผู้ใช้ แล้วเข้าสู่กระบวนการจอง (ข้ามขั้น login)
  useEffect(() => {
    let cancelled = false
    let intent: string | null = null
    try {
      intent = sessionStorage.getItem('google_login_intent') || localStorage.getItem('google_login_intent')
    } catch {
      intent = null
    }
    if (!intent) return

    const syncGoogleUser = async () => {
      try {
        const googleSession = await getSession()
        const googleId = (googleSession?.user as { googleId?: string } | undefined)?.googleId
        if (!googleId) return

        const res = await fetch(apiUrl('/api/auth/google/sync'), { method: 'POST' })
        if (!res.ok) throw new Error(`Google sync failed (${res.status})`)
        const u: { id: string; name: string | null; email: string | null } = await res.json()
        if (cancelled) return

        setLineUser({
          id: u.id,
          lineUserId: '',
          lineDisplayName: null,
          linePictureUrl: null,
          name: u.name,
          phone: null,
          email: u.email,
        })
        try {
          sessionStorage.removeItem('google_login_intent')
          localStorage.removeItem('google_login_intent')
        } catch {
          // ignore
        }
        setStep(2)
      } catch (error) {
        console.error('Google login sync failed', error)
        if (!cancelled) toast.error('เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่')
      }
    }

    void syncGoogleUser()
    return () => { cancelled = true }
  }, [setLineUser, setStep])

  // จำสถานะล็อกอินเดิม — ถ้าเคยล็อกอิน (cookie p19_customer_session ยังไม่หมดอายุ) ให้ข้ามหน้าล็อกอินไปเลย
  useEffect(() => {
    // กำลังกลับจาก callback LINE (มี code + state) → ปล่อยให้ effect ด้านบนจัดการ
    const params = new URLSearchParams(window.location.search)
    if (params.get('code') && params.get('state')) return

    // กำลังกลับจาก Google (มี intent ค้างอยู่) → ปล่อยให้ effect Google จัดการ
    let pendingGoogle: string | null = null
    try {
      pendingGoogle =
        sessionStorage.getItem('google_login_intent') || localStorage.getItem('google_login_intent')
    } catch {
      pendingGoogle = null
    }
    if (pendingGoogle) return

    // อยู่ที่ขั้นล็อกอิน (step 1) เท่านั้นจึงจะเลื่อน — กันกรณี refresh กลางกระบวนการจอง
    if (useBookingStore.getState().step !== 1) return

    let cancelled = false
    const restoreSession = async () => {
      try {
        const res = await fetch(apiUrl('/api/wallet/session'), { cache: 'no-store' })
        if (!res.ok) return
        const u = (await res.json()) as {
          id?: string
          lineDisplayName?: string | null
          linePictureUrl?: string | null
          name?: string | null
        } | null
        if (cancelled || !u || typeof u.id !== 'string') return
        setLineUser({
          id: u.id,
          lineUserId: '',
          lineDisplayName: u.lineDisplayName ?? null,
          linePictureUrl: u.linePictureUrl ?? null,
          name: u.name ?? null,
          phone: null,
          email: null,
        })
        setStep(2)
      } catch {
        // ไม่มีเซสชัน / เน็ตมีปัญหา — คงอยู่ที่หน้าล็อกอินตามเดิม
      }
    }
    void restoreSession()
    return () => { cancelled = true }
  }, [setLineUser, setStep])

  // อัปเดต URL ตาม step (?step=2..5) ทุกครั้งที่เปลี่ยนขั้น — refresh/แชร์ลิงก์แล้วอยู่ step เดิม
  useEffect(() => {
    if (typeof window === 'undefined') return
    const currentStep = useBookingStore.getState().step
    const url = new URL(window.location.href)
    const next = currentStep >= 2 && currentStep <= 4 ? String(currentStep) : null
    if (url.searchParams.get('step') === next) return
    if (next) url.searchParams.set('step', next)
    else url.searchParams.delete('step')
    window.history.replaceState({}, '', url.toString())
  }, [step])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      {/* Header + Menu */}
      <SiteHeader showSettings={false} />

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {step >= 1 && step <= 4 && <StepperHeader />}

        <div className="mt-4">
          {step === 1 && <StepLineLogin />}
          {step === 2 && <StepGrid />}
          {step === 3 && <StepSummary />}
          {step === 4 && <StepConfirm />}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/60">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <MapPin className="h-3 w-3" />
            <span>P19 Pickleball Arena</span>
          </div>
          <p>© 2025 P19 Pickleball Arena. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
