'use client'

import { useCallback } from 'react'
import { ArrowLeft, MessageCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBookingStore } from '@/store/booking-store'

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'YOUR_CHANNEL_ID'
const LINE_LOGIN_REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/` : ''

export function StepLineLogin() {
  const { setStep, setSelectedTimeSlot, setLineUser, setLineLoginSkipped, setIsLoading, isLoading } = useBookingStore()

  const handleLineLogin = useCallback(() => {
    setIsLoading(true)
    const state = crypto.randomUUID()
    sessionStorage.setItem('line_login_state', state)
    sessionStorage.setItem('line_login_intent', 'booking')

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINE_CHANNEL_ID,
      redirect_uri: LINE_LOGIN_REDIRECT_URI,
      state,
      scope: 'profile openid',
      bot_prompt: 'normal',
    })

    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
  }, [setIsLoading])

  const handleSkipLogin = async () => {
    setLineLoginSkipped(true)
    setStep(4)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setStep(4)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">เข้าสู่ระบบด้วย LINE</h2>
      </div>

      <Card className="border-emerald-200">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <MessageCircle className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">เข้าสู่ระบบด้วย LINE</h3>
            <p className="text-sm text-muted-foreground mt-2">
              เข้าสู่ระบบเพื่อยืนยันตัวตนและรับการแจ้งเตือนผ่าน LINE OA
              ของ P19 Pickleball Arena
            </p>
          </div>

          <div className="space-y-3 pt-2">
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