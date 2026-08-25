'use client'

import { useEffect, useState } from 'react'
import { Dumbbell, Phone, MapPin, Settings } from 'lucide-react'
import { StepperHeader } from '@/components/booking/stepper-header'
import { StepDate } from '@/components/booking/step-date'
import { StepCourt } from '@/components/booking/step-court'
import { StepTimeSlot } from '@/components/booking/step-timeslot'
import { StepSummary } from '@/components/booking/step-summary'
import { StepConfirm } from '@/components/booking/step-confirm'
import { StepSuccess } from '@/components/booking/step-success'
import { useBookingStore } from '@/store/booking-store'
import type { BookingItem, RentalItem } from '@/store/booking-store'

export default function BookingPage() {
  const { step, setLineUser, setStep, setIsLoading, setRentalSelections } = useBookingStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Seed data on first load
    fetch('/api/seed', { method: 'POST' }).catch(() => {})

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

    if (code && state) {
      const savedState = sessionStorage.getItem('line_login_state')
      const intent = sessionStorage.getItem('line_login_intent')

      if (savedState === state && intent === 'booking') {
        handleLineCallback(code)
        window.history.replaceState({}, '', '/')
      }
    }
  }, [])

  const handleLineCallback = async (code: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/line-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: 'demo_user_' + code.substring(0, 8),
          lineDisplayName: 'ผู้ใช้ LINE',
          linePictureUrl: null,
        }),
      })

      const user = await res.json()
      setLineUser(user)
      setStep(5)
      sessionStorage.removeItem('line_login_state')
      sessionStorage.removeItem('line_login_intent')
    } catch (err) {
      console.error('LINE auth error:', err)
      setStep(5)
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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight">P19 Pickleball Arena</h1>
                <p className="text-[11px] text-muted-foreground leading-tight">จองสนามออนไลน์</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/settings"
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="ตั้งค่า"
              >
                <Settings className="h-4 w-4" />
              </a>
              <a
                href="tel:02-xxx-xxxx"
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">ติดต่อเรา</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {step >= 1 && step <= 5 && <StepperHeader />}

        <div className="mt-4">
          {step === 1 && <StepDate />}
          {step === 2 && <StepCourt />}
          {step === 3 && <StepTimeSlot />}
          {step === 4 && <StepSummary />}
          {step === 5 && <StepConfirm />}
          {step === 6 && <StepSuccess />}
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
