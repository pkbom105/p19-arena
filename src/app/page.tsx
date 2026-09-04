'use client'

import { apiUrl, lineRedirectUri } from '@/lib/api'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MapPin } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { StepperHeader } from '@/components/booking/stepper-header'
import { StepDate } from '@/components/booking/step-date'
import { StepCourt } from '@/components/booking/step-court'
import { StepTimeSlot } from '@/components/booking/step-timeslot'
import { StepSummary } from '@/components/booking/step-summary'
import { StepConfirm } from '@/components/booking/step-confirm'
import { StepSuccess } from '@/components/booking/step-success'
import { StepLineLogin } from '@/components/booking/step-line-login'
import { useBookingStore } from '@/store/booking-store'
import type { BookingItem, RentalItem } from '@/store/booking-store'

export default function BookingPage() {
  const { step, setLineUser, setStep, setIsLoading, setRentalSelections } = useBookingStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

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
    const code = params.get('code')
    const state = params.get('state')

    // LINE ส่ง error กลับมาทาง query (เช่น error=access_denied) — แจ้งผู้ใช้แทนการเงียบ
    const oauthError = params.get('error')

    if (oauthError) {
      toast.error(`LINE Login ไม่สำเร็จ: ${params.get('error_description') || oauthError}`)
      window.history.replaceState({}, '', '/')
      return
    }

    if (code && state) {
      // state เก็บไว้ทั้ง 2 ที่ (sessionStorage + localStorage) — เผื่อ browser ที่ล้าง sessionStorage ตอน redirect
      const savedState =
        sessionStorage.getItem('line_login_state') || localStorage.getItem('line_login_state')

      if (savedState === state) {
        handleLineCallback(code)
        window.history.replaceState({}, '', '/')
      }
    }
  }, [])

  const handleLineCallback = async (code: string) => {
    setIsLoading(true)
    try {
      // แลก code เป็น LINE User ID จริง (server-side) -> user record เดิม -> auto-fill ได้
      const res = await fetch(apiUrl('/api/line-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          // ต้องตรงกับ Callback URL ที่ลงทะเบียนใน LINE console เป๊ะ และเหมือนกันทุกเครื่อง
          redirectUri: lineRedirectUri(),
        }),
      })

      const user = await res.json()

      if (res.ok && user && user.id) {
        setLineUser(user)
      } else {
        console.error('LINE auth error:', user?.error || res.status)
        // code ใช้ซ้ำ/หมดอายุ (กด refresh ตอนหน้า callback) = invalid_grant — ให้ลอง login ใหม่
        toast.error(user?.error || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณากดเข้าสู่ระบบอีกครั้ง')
      }

      setStep(2)
      sessionStorage.removeItem('line_login_state')
      sessionStorage.removeItem('line_login_intent')
      try {
        localStorage.removeItem('line_login_state')
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
      <SiteHeader />

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {step >= 1 && step <= 6 && <StepperHeader />}

        <div className="mt-4">
          {step === 1 && <StepLineLogin />}
          {step === 2 && <StepDate />}
          {step === 3 && <StepCourt />}
          {step === 4 && <StepTimeSlot />}
          {step === 5 && <StepSummary />}
          {step === 6 && <StepConfirm />}
          {step === 7 && <StepSuccess />}
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
