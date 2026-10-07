'use client'

import { apiUrl } from '@/lib/api'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ArrowLeft, User, Mail, MessageSquare, CalendarDays,
  MapPin, Clock, Wrench,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useBookingStore } from '@/store/booking-store'
import { StepSuccess } from './step-success'
import { toast } from 'sonner'
import { getItemPriceWithRules, type PriceRule } from '@/lib/price'
import { formatThaiDateWithDay as formatDate } from '@/lib/thai-date'

function formatPrice(amount: number) {
  return amount.toLocaleString()
}

function getItemPrice(item: { court: { pricePerHour: number }; timeSlots: { id: string; startTime: string }[]; date: string }, rules: PriceRule[]) {
  return getItemPriceWithRules(item, rules)
}

/**
 * ชั่วโมงที่ติ๊กให้โค้ชดูแล ต่อรายการจอง (คีย์ `${itemId}|${slotId}` ที่ติ๊กในขั้นสรุปการจอง)
 * — ส่งไปกับ POST เพื่อให้ค่าโค้ชคิดเฉพาะชั่วโมงที่ติ๊กจริง (ไม่ใช่ทุกชั่วโมงที่จอง)
 */
function buildCoachStartTimesByItem(
  keys: string[],
  items: { id: string; timeSlots: { id: string; startTime: string }[] }[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const key of keys) {
    const [itemId, slotId] = key.split('|')
    const item = items.find((it) => it.id === itemId)
    const ts = item?.timeSlots.find((s) => s.id === slotId)
    if (!item || !ts) continue
    map[item.id] = [...(map[item.id] ?? []), ts.startTime].sort()
  }
  return map
}

export function StepConfirm() {
  const {
    bookingItems,
    rentalSelections,
    bookingForm,
    goToStep,
    setIsLoading,
    isLoading,
    setSubmittedBookings,
    slip,
    priceRules,
    setPriceRules,
    lineUser,
    coach,
    setCoach,
    coachTickedKeys,
  } = useBookingStore()

  const [errors, setErrors] = useState<Record<string, string>>({})
  /** จองสำเร็จแล้ว → แสดงการ์ด QR ตั๋ว (แทน step 5) */
  const [done, setDone] = useState(false)
  /** CoachBooking ที่สร้างไปแล้วต่อ 1 สนาม — ส่งกลับไปให้ API ต่อท้ายแถวเดิมของรอบเดียวกัน */
  const coachBookingIdsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    fetch(apiUrl('/api/pricerules'))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPriceRules(data)
      })
      .catch(() => {})
  }, [setPriceRules])

  const totalSlots = bookingItems.reduce((sum, item) => sum + item.timeSlots.length, 0)
  const courtPrice = bookingItems.reduce((sum, item) => sum + getItemPrice(item, priceRules), 0)
  const rentalPrice = rentalSelections.reduce((sum, r) => sum + r.pricePerUnit * r.quantity, 0)
  // ชั่วโมงที่ติ๊กให้โค้ชดูแล แยกตามรายการจอง — ส่งไปกับ POST เพื่อคิดค่าโค้ชเฉพาะชั่วโมงที่ติ๊ก
  const coachStartTimesByItem = useMemo(
    () => buildCoachStartTimesByItem(coachTickedKeys, bookingItems),
    [coachTickedKeys, bookingItems]
  )
  // ค่าโค้ช = ราคา/ชม. × จำนวนชั่วโมงที่ติ๊กให้โค้ชดูแล (ยอดเดียวกับที่แสดงในขั้นสรุปการจอง)
  const coachHours = coach ? coachTickedKeys.length : 0
  const coachFee = coach ? coach.pricePerHour * coachHours : 0
  const totalPrice = courtPrice + rentalPrice + coachFee

  // Count total rackets across all bookings (for the first racket-type item)
  const totalRackets = rentalSelections.reduce((sum, r) => {
    if (r.name.includes('แร็กเก็ต') || r.name.toLowerCase().includes('racket')) {
      return sum + r.quantity
    }
    return sum
  }, 0)

const validate = () => {
    const errs: Record<string, string> = {}
    if (!slip) errs.slip = 'ไม่พบสลิปการชำระเงิน — กรุณากลับไปอัปโหลดสลิปที่ขั้นสรุปการจอง'
    setErrors(errs)
    return Object.keys(errs).length === 0
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
          const res = await fetch(apiUrl('/api/bookings'), {
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
              slipDataUrl: slip?.dataUrl || undefined,
              slipName: slip?.name || undefined,
              verify: slip?.verify ?? null,
              coachId: coach?.id || undefined,
              coachBookingId: coach ? coachBookingIdsRef.current[item.court.id] : undefined,
              // ช่องที่ติ๊กให้โค้ชดูแลของรายการนี้ — ส่งไปเพื่อคิดค่าโค้ช/บันทึกคิวเฉพาะชั่วโมงที่ติ๊ก
              coachStartTimes: coach ? (coachStartTimesByItem[item.id] ?? []) : undefined,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            toast.error(`${formatDate(item.date)} ${slot.startTime}-${slot.endTime}: ${data.error}`)
            hasError = true
          } else {
            // จำ CoachBooking ของสนามนี้ไว้ — ช่วงเวลาถัดไปจะได้ต่อท้ายแถวเดิม ไม่สร้างซ้ำ
            if (coach && data.coachBookingId) {
              coachBookingIdsRef.current[item.court.id] = String(data.coachBookingId)
            }
            if (data.coachBookingError) {
              toast.warning('จองสนามสำเร็จ แต่บันทึกคิวโค้ชไม่สำเร็จ — เจ้าหน้าที่จะตรวจสอบให้')
            }
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
      setDone(true)
      toast.success(`จองสำเร็จ ${results.length} รายการ!`)
      // จองครบทุกช่วงเวลาแล้ว → ล้างค่าโค้ช ไม่ให้ติดไปการจองครั้งถัดไป
      if (coach && !hasError) {
        try {
          sessionStorage.removeItem('coach_id')
        } catch {
          // เข้าถึง sessionStorage ไม่ได้ — ข้ามไป
        }
        coachBookingIdsRef.current = {}
        setCoach(null)
      }
    }
    setIsLoading(false)
  }

  const activeRentals = rentalSelections.filter((r) => r.quantity > 0)

  // จองสำเร็จ → แสดงการ์ด QR ตั๋ว (แทน step 5 ที่นำออก)
  if (done) {
    return <StepSuccess />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToStep(3)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">ยืนยันการจอง</h2>
      </div>

      {/* Compact booking items summary */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>บัตรการจอง — รายการทั้งหมด</span>
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
            {coachFee > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  ค่าโค้ช ({coach?.name} × {coachHours} ชม.)
                </span>
                <span>฿{formatPrice(coachFee)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-bold text-emerald-700 pt-1">
              <span>รวมทั้งหมด</span>
              <span>฿{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ข้อมูลผู้จอง — จากขั้นสรุป (step 5) แสดงเป็นบัตร */}
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-muted-foreground">ชื่อผู้จอง</div>
              <div className="font-semibold">{bookingForm.playerName || '-'}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-muted-foreground">เบอร์โทร</div>
              <div className="font-medium font-mono">{bookingForm.playerPhone || '-'}</div>
            </div>
          </div>
          {bookingForm.playerEmail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{bookingForm.playerEmail}</span>
            </div>
          )}
          {bookingForm.note && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="break-words">{bookingForm.note}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {errors.slip && <p className="text-xs text-red-500 text-center">{errors.slip}</p>}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => goToStep(3)}>
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
