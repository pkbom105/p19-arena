'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, User, Phone, Mail, MessageSquare, CalendarDays,
  MapPin, Clock, UploadCloud, X, Wrench,
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
import { getItemPriceWithRules, type PriceRule } from '@/lib/price'

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const MAX_SLIP_SIZE = 300 * 1024 // 300kB

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = THAI_DAYS[d.getDay()]
  return `${dayName} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

function formatPrice(amount: number) {
  return amount.toLocaleString()
}

function getItemPrice(item: { court: { pricePerHour: number }; timeSlots: { id: string; startTime: string }[]; date: string }, rules: PriceRule[]) {
  return getItemPriceWithRules(item, rules)
}

export function StepConfirm() {
  const {
    bookingItems,
    rentalSelections,
    bookingForm,
    setBookingForm,
    setStep,
    goToStep,
    setIsLoading,
    isLoading,
    setSubmittedBookings,
    slip,
    setSlip,
    priceRules,
    setPriceRules,
  } = useBookingStore()

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [slipError, setSlipError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/pricerules')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPriceRules(data)
      })
      .catch(() => {})
  }, [setPriceRules])

  const totalSlots = bookingItems.reduce((sum, item) => sum + item.timeSlots.length, 0)
  const courtPrice = bookingItems.reduce((sum, item) => sum + getItemPrice(item, priceRules), 0)
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
    if (!slip) errs.slip = 'กรุณาอัปโหลดสลิปการชำระเงิน'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setSlipError(null)
    if (!file) return

    // Validate type: jpg/jpeg/png only
    const isJpg = file.type === 'image/jpeg'
    const isPng = file.type === 'image/png'
    if (!isJpg && !isPng) {
      setSlipError('รองรับเฉพาะไฟล์ .jpg หรือ .png เท่านั้น')
      e.target.value = ''
      return
    }

    // Validate size: max 300kB
    if (file.size > MAX_SLIP_SIZE) {
      setSlipError(`ไฟล์ใหญ่เกินไป (สูงสุด 300kB) — ไฟล์นี้ ${Math.ceil(file.size / 1024)}kB`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSlip({
        dataUrl: String(reader.result),
        name: file.name,
        size: file.size,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveSlip = () => {
    setSlip(null)
    setSlipError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
              racketCount: totalRackets,
              slipDataUrl: slip?.dataUrl || undefined,
              slipName: slip?.name || undefined,
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
            const itemPrice = getItemPrice(item, priceRules)
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

      {/* Slip upload section */}
      <Card className="border-emerald-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <UploadCloud className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-medium text-sm">อัปโหลดสลิปการชำระเงิน</h3>
              <p className="text-[11px] text-muted-foreground">รองรับไฟล์ .jpg หรือ .png เท่านั้น ขนาดไม่เกิน 300kB</p>
            </div>
          </div>

          {slip ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              {slip.dataUrl && (
                <img src={slip.dataUrl} alt="สลิป" className="w-14 h-14 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{slip.name}</div>
                <div className="text-xs text-emerald-700">อัปโหลดแล้ว ({Math.ceil(slip.size / 1024)}kB)</div>
              </div>
              <button
                type="button"
                onClick={handleRemoveSlip}
                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 shrink-0"
                aria-label="ลบสลิป"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-emerald-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:bg-emerald-50/50 transition-colors cursor-pointer"
            >
              <UploadCloud className="h-8 w-8 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700">แตะเพื่อเลือกไฟล์สลิป</span>
              <span className="text-[11px] text-muted-foreground">jpg / png — ไม่เกิน 300kB</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleSlipChange}
          />

          {slipError && <p className="text-xs text-red-500">{slipError}</p>}
          {errors.slip && <p className="text-xs text-red-500">{errors.slip}</p>}
        </CardContent>
      </Card>

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
