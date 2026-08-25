'use client'

import { useState, useCallback } from 'react'
import {
  ArrowLeft, User, Phone, Mail, MessageSquare, CalendarDays,
  MapPin, Clock, MessageCircle, Loader2, Wrench,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useBookingStore } from '@/store/booking-store'
import { toast } from 'sonner'

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'YOUR_CHANNEL_ID'
const LINE_LOGIN_REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/` : ''

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = THAI_DAYS[d.getDay()]
  return `${dayName} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

function formatPrice(amount: number) {
  return amount.toLocaleString()
}

function getItemPrice(item: { court: { pricePerHour: number }; timeSlots: { id: string }[] }) {
  return item.timeSlots.length * item.court.pricePerHour
}

export function StepConfirm() {
  const {
    bookingItems,
    rentalSelections,
    lineUser,
    lineLoginSkipped,
    bookingForm,
    setBookingForm,
    setStep,
    goToStep,
    setIsLoading,
    isLoading,
    setSubmittedBookings,
    setLineLoginSkipped,
  } = useBookingStore()

  const [errors, setErrors] = useState<Record<string, string>>({})

  const totalSlots = bookingItems.reduce((sum, item) => sum + item.timeSlots.length, 0)
  const courtPrice = bookingItems.reduce((sum, item) => sum + getItemPrice(item), 0)
  const rentalPrice = rentalSelections.reduce((sum, r) => sum + r.pricePerUnit * r.quantity, 0)
  const totalPrice = courtPrice + rentalPrice

  // Count total rackets across all bookings (for the first racket-type item)
  const totalRackets = rentalSelections.reduce((sum, r) => {
    if (r.name.includes('แร็กเก็ต') || r.name.toLowerCase().includes('racket')) {
      return sum + r.quantity
    }
    return sum
  }, 0)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!bookingForm.playerName.trim()) errs.playerName = 'กรุณากรอกชื่อ'
    if (!bookingForm.playerPhone.trim()) errs.playerPhone = 'กรุณากรอกเบอร์โทร'
    else if (!/^\d{9,10}$/.test(bookingForm.playerPhone.replace(/[-\s]/g, '')))
      errs.playerPhone = 'เบอร์โทรไม่ถูกต้อง'
    if (bookingForm.playerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingForm.playerEmail))
      errs.playerEmail = 'อีเมลไม่ถูกต้อง'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleLineLogin = useCallback(() => {
    // Persist bookingItems for after redirect
    sessionStorage.setItem('booking_items', JSON.stringify(bookingItems))
    sessionStorage.setItem('booking_form', JSON.stringify(bookingForm))
    sessionStorage.setItem('booking_return_step', '5')
    sessionStorage.setItem('rental_selections', JSON.stringify(rentalSelections))

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
  }, [bookingItems, bookingForm, rentalSelections, setIsLoading])

  const handleSubmit = async () => {
    if (!validate()) return
    await submitBookings()
  }

  const submitBookings = async () => {
    setIsLoading(true)
    const results: unknown[] = []
    let hasError = false

    for (const item of bookingItems) {
      for (const slot of item.timeSlots) {
        try {
          const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courtId: item.court.id,
              timeSlotId: slot.id,
              bookingDate: item.date,
              playerName: bookingForm.playerName,
              playerPhone: bookingForm.playerPhone,
              playerEmail: bookingForm.playerEmail || undefined,
              note: bookingForm.note || undefined,
              userId: lineUser?.id || undefined,
              racketCount: totalRackets,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            toast.error(`${formatDate(item.date)} ${slot.startTime}-${slot.endTime}: ${data.error}`)
            hasError = true
          } else {
            results.push(data)
          }
        } catch {
          toast.error(`${slot.startTime}-${slot.endTime}: ล้มเหลว`)
          hasError = true
        }
      }
    }

    if (results.length > 0) {
      setSubmittedBookings(results)
      setStep(6)
      toast.success(`จองสำเร็จ ${results.length} รายการ!`)
    }
    setIsLoading(false)
  }

  const activeRentals = rentalSelections.filter((r) => r.quantity > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToStep(4)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">ยืนยันการจอง</h2>
      </div>

      {/* Compact booking items summary */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>รายการจองทั้งหมด</span>
            <Badge className="bg-emerald-600 text-[11px]">{totalSlots} ชม.</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2.5">
          {bookingItems.map((item, idx) => {
            const sortedSlots = [...item.timeSlots].sort((a, b) => a.sortOrder - b.sortOrder)
            const itemPrice = getItemPrice(item)
            return (
              <div key={item.id}>
                {idx > 0 && <Separator className="my-2" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium text-xs">{formatDate(item.date)}</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">฿{formatPrice(itemPrice)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs">{item.court.name}</span>
                  <span className="text-[10px] text-muted-foreground">(฿{formatPrice(item.court.pricePerHour)}/ชม.)</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1 ml-5.5">
                  {sortedSlots.map((s) => (
                    <span
                      key={s.id}
                      className="bg-emerald-100 text-emerald-700 text-[11px] font-medium px-1.5 py-0.5 rounded"
                    >
                      {s.startTime}-{s.endTime}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Rental items in confirm */}
          {activeRentals.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-2 text-sm">
                <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="font-medium text-xs">อุปกรณ์เช่า</span>
              </div>
              {activeRentals.map((r) => (
                <div key={r.id} className="flex items-center justify-between ml-5.5 text-xs">
                  <span className="text-muted-foreground">{r.name} x{r.quantity}</span>
                  <span className="font-medium text-amber-700">฿{formatPrice(r.pricePerUnit * r.quantity)}</span>
                </div>
              ))}
            </>
          )}

          {/* Price breakdown */}
          <Separator className="my-2" />
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">ค่าสนาม</span>
              <span>฿{formatPrice(courtPrice)}</span>
            </div>
            {rentalPrice > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ค่าเช่าอุปกรณ์</span>
                <span>฿{formatPrice(rentalPrice)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-bold text-emerald-700 pt-1">
              <span>รวมทั้งหมด</span>
              <span>฿{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LINE Login section */}
      {!lineUser && !lineLoginSkipped && (
        <Card className="border-green-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">เข้าสู่ระบบด้วย LINE</h3>
                <p className="text-[11px] text-muted-foreground">รับการแจ้งเตือนและดูประวัติการจอง</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                size="sm"
                onClick={handleLineLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.5 2 2 5.8 2 10.4c0 2.8 1.5 5.3 3.8 7l-1 3.6 4.2-2.2c1 .3 2 .4 3 .4 5.5 0 10-3.8 10-8.4S17.5 2 12 2z" />
                  </svg>
                )}
                เข้าสู่ระบบ LINE
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setLineLoginSkipped(true)}
              >
                ข้าม
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LINE user badge */}
      {lineUser && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          {lineUser.linePictureUrl && (
            <img
              src={lineUser.linePictureUrl}
              alt={lineUser.lineDisplayName || ''}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {lineUser.lineDisplayName || lineUser.name}
            </div>
            <div className="text-xs text-muted-foreground">เข้าสู่ระบบด้วย LINE แล้ว</div>
          </div>
          <svg className="h-5 w-5 text-green-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.5 2 2 5.8 2 10.4c0 2.8 1.5 5.3 3.8 7l-1 3.6 4.2-2.2c1 .3 2 .4 3 .4 5.5 0 10-3.8 10-8.4S17.5 2 12 2z" />
          </svg>
        </div>
      )}

      {lineLoginSkipped && !lineUser && (
        <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg border">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">จองโดยไม่ได้เข้าสู่ระบบ LINE</span>
        </div>
      )}

      <Separator />

      {/* Player info form */}
      <div className="space-y-4">
        <h3 className="font-medium">ข้อมูลผู้จอง</h3>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="playerName" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> ชื่อ-นามสกุล <span className="text-red-500">*</span>
            </Label>
            <Input
              id="playerName"
              placeholder="กรอกชื่อ-นามสกุล"
              value={bookingForm.playerName}
              onChange={(e) => setBookingForm({ playerName: e.target.value })}
              className={errors.playerName ? 'border-red-400' : ''}
            />
            {errors.playerName && <p className="text-xs text-red-500">{errors.playerName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="playerPhone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> เบอร์โทรศัพท์ <span className="text-red-500">*</span>
            </Label>
            <Input
              id="playerPhone"
              placeholder="0XX-XXX-XXXX"
              value={bookingForm.playerPhone}
              onChange={(e) => setBookingForm({ playerPhone: e.target.value })}
              className={errors.playerPhone ? 'border-red-400' : ''}
            />
            {errors.playerPhone && <p className="text-xs text-red-500">{errors.playerPhone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="playerEmail" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> อีเมล (ไม่จำเป็น)
            </Label>
            <Input
              id="playerEmail"
              type="email"
              placeholder="example@email.com"
              value={bookingForm.playerEmail}
              onChange={(e) => setBookingForm({ playerEmail: e.target.value })}
              className={errors.playerEmail ? 'border-red-400' : ''}
            />
            {errors.playerEmail && <p className="text-xs text-red-500">{errors.playerEmail}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> หมายเหตุ (ไม่จำเป็น)
            </Label>
            <Textarea
              id="note"
              placeholder="หมายเหตุเพิ่มเติม เช่น ต้องการเช่าอุปกรณ์"
              value={bookingForm.note}
              onChange={(e) => setBookingForm({ note: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => goToStep(4)}>
          ย้อนกลับ
        </Button>
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? 'กำลังจอง...' : `ยืนยันการจอง ฿${formatPrice(totalPrice)}`}
        </Button>
      </div>
    </div>
  )
}
