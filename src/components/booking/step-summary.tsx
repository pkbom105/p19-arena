'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarDays, MapPin, Clock, ChevronRight, ClipboardList, Wrench, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useBookingStore } from '@/store/booking-store'
import type { BookingItem, RentalItem } from '@/store/booking-store'

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = THAI_DAYS[d.getDay()]
  return `${dayName} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

function formatPrice(amount: number) {
  return amount.toLocaleString()
}

function getItemPrice(item: BookingItem) {
  return item.timeSlots.length * item.court.pricePerHour
}

function getItemHours(item: BookingItem) {
  return item.timeSlots.reduce((s, ts) => {
    const start = parseInt(ts.startTime.split(':')[0]) + parseInt(ts.startTime.split(':')[1]) / 60
    const end = parseInt(ts.endTime.split(':')[0]) + parseInt(ts.endTime.split(':')[1]) / 60
    return s + (end - start)
  }, 0)
}

function BookingItemCard({ item, onRemove }: { item: BookingItem; onRemove: () => void }) {
  const sortedSlots = [...item.timeSlots].sort((a, b) => a.sortOrder - b.sortOrder)
  const itemPrice = getItemPrice(item)
  const itemHours = getItemHours(item)

  return (
    <Card className="border-emerald-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{formatDate(item.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{item.court.name}</span>
              <span className="text-[11px] text-muted-foreground">(฿{formatPrice(item.court.pricePerHour)}/ชม.)</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {sortedSlots.map((s) => (
                  <span
                    key={s.id}
                    className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded"
                  >
                    {s.startTime} - {s.endTime}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="ลบรายการ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
              ฿{formatPrice(itemPrice)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {itemHours} ชม.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StepSummary() {
  const { bookingItems, removeBookingItem, setStep, goToStep, rentalSelections, setRentalSelections, updateRentalQuantity } = useBookingStore()
  const [equipment, setEquipment] = useState<RentalItem[]>([])
  const [equipLoading, setEquipLoading] = useState(true)

  useEffect(() => {
    async function fetchEquipment() {
      try {
        const res = await fetch('/api/equipment')
        const data = await res.json()
        // Initialize rental selections from available equipment
        const items: RentalItem[] = data.map((e: { id: string; name: string; nameEn: string | null; pricePerUnit: number }) => ({
          id: e.id,
          name: e.name,
          nameEn: e.nameEn,
          pricePerUnit: e.pricePerUnit,
          quantity: 0,
        }))
        setEquipment(items)
        // Only set initial selections if not already set
        setRentalSelections(items)
      } catch (err) {
        console.error('Failed to fetch equipment', err)
      } finally {
        setEquipLoading(false)
      }
    }
    fetchEquipment()
  }, [setRentalSelections])

  const totalSlots = bookingItems.reduce((sum, item) => sum + item.timeSlots.length, 0)
  const totalHours = bookingItems.reduce((sum, item) => sum + getItemHours(item), 0)
  const courtPrice = bookingItems.reduce((sum, item) => sum + getItemPrice(item), 0)
  const rentalPrice = rentalSelections.reduce((sum, r) => sum + r.pricePerUnit * r.quantity, 0)
  const totalPrice = courtPrice + rentalPrice

  const handleAddMore = () => {
    // Go to step 2 (court selection) keeping the date for multi-court booking
    goToStep(2)
  }

  const handleProceed = () => {
    setStep(5)
  }

  if (bookingItems.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">สรุปรายการจอง</h2>
        </div>

        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <CalendarDays className="h-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground">ยังไม่มีรายการจอง</p>
            <p className="text-sm text-muted-foreground mt-1">เลือกวัน เวลา และสนามที่ต้องการจอง</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => goToStep(1)}>
            <Plus className="h-4 w-4 mr-2" />
            เลือกวันที่จอง
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">สรุปรายการจอง</h2>
        <Badge className="bg-emerald-500 text-white ml-auto">
          {totalSlots} ช่วงเวลา
        </Badge>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{bookingItems.length}</div>
            <div className="text-[11px] text-emerald-600">รายการ</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{totalHours}</div>
            <div className="text-[11px] text-emerald-600">ชั่วโมง</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-700">฿{formatPrice(courtPrice)}</div>
            <div className="text-[11px] text-emerald-600">ราคาสนาม</div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Booking items list */}
      <div className="space-y-3">
        {bookingItems.map((item, index) => (
          <div key={item.id} className="relative">
            {index > 0 && (
              <div className="absolute -top-2 left-6 right-6 h-px border-t border-dashed border-emerald-200" />
            )}
            <BookingItemCard item={item} onRemove={() => removeBookingItem(item.id)} />
          </div>
        ))}
      </div>

      {/* Rental Equipment Section */}
      {rentalSelections.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              เช่าอุปกรณ์เพิ่มเติม
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {rentalSelections.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground">฿{formatPrice(item.pricePerUnit)}/ชิ้น</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-amber-300 flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-30"
                    onClick={() => updateRentalQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-amber-300 flex items-center justify-center hover:bg-amber-100 transition-colors"
                    onClick={() => updateRentalQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {item.quantity > 0 && (
                    <span className="text-xs font-semibold text-amber-700 w-16 text-right">
                      ฿{formatPrice(item.pricePerUnit * item.quantity)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Total price */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">ค่าสนาม</span>
          <span className="font-medium">฿{formatPrice(courtPrice)}</span>
        </div>
        {rentalPrice > 0 && (
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="text-muted-foreground">ค่าเช่าอุปกรณ์</span>
            <span className="font-medium">฿{formatPrice(rentalPrice)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-1 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
          <span className="text-sm font-medium text-emerald-800">ราคารวมทั้งหมด</span>
          <span className="text-xl font-bold text-emerald-700">฿{formatPrice(totalPrice)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm border-t pt-3 pb-1 -mx-4 px-4 mt-4 space-y-2">
        <Button
          variant="outline"
          className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={handleAddMore}
        >
          <Plus className="h-4 w-4 mr-2" />
          จองเพิ่ม — เลือกสนามอีกครั้ง
        </Button>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleProceed}
        >
          ถัดไป
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
