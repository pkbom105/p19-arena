'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COACH_SLOT_TIMES } from '@/components/activity/coaches'
import { formatTHB } from './catalog'
import type { ShopProduct } from './types'

/** Dialog เลือกวัน + เวลาเริ่ม-สิ้นสุด + อัตราต่อชม. สำหรับสินค้าหมวด "โค้ช" ก่อนเพิ่มลงตะกร้า */
export function CoachBookingDialog({ product, open, onOpenChange, onConfirm }: {
  product: ShopProduct | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (date: Date, startTime: string, endTime: string) => void
}) {
  const [date, setDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  /** อัตราต่อชั่วโมง = ราคาสินค้าโค้ช (pricePerHour) */
  const rate = product?.price ?? 0
  const hours = startTime && endTime ? Number(endTime.slice(0, 2)) - Number(startTime.slice(0, 2)) : 0
  const valid = Boolean(date) && Boolean(startTime) && Boolean(endTime) && hours > 0
  const total = rate * Math.max(0, hours)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-emerald-600" /> จองโค้ช — {product?.name ?? ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* อัตราค่าโค้ชต่อชั่วโมง */}
          <div className="flex items-center justify-between rounded-lg border bg-emerald-50/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">อัตราค่าโค้ช</span>
            <span className="font-semibold text-emerald-700">{formatTHB(rate)} / ชม.</span>
          </div>

          {/* วันที่ */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'd MMMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d < today}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* เวลาเริ่ม - สิ้นสุด */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">เวลาเริ่ม</span>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="w-full">
                  <Clock className="mr-1 h-3.5 w-3.5" />
                  <SelectValue placeholder="เริ่ม" />
                </SelectTrigger>
                <SelectContent>
                  {COACH_SLOT_TIMES.map((t) => (
                    <SelectItem key={t} value={t}>{t} น.</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">เวลาสิ้นสุด</span>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="w-full">
                  <Clock className="mr-1 h-3.5 w-3.5" />
                  <SelectValue placeholder="สิ้นสุด" />
                </SelectTrigger>
                <SelectContent>
                  {COACH_SLOT_TIMES.map((t) => (
                    <SelectItem key={t} value={t}>{t} น.</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* สรุปชั่วโมง + ยอดรวม */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {hours > 0 ? `${hours} ชม. × ${formatTHB(rate)}/ชม.` : 'เลือกเวลาเริ่ม–สิ้นสุด'}
            </span>
            <span className="text-base font-bold text-emerald-700">{hours > 0 ? formatTHB(total) : '—'}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!valid}
            onClick={() => onConfirm(date, startTime, endTime)}
          >
            เพิ่มลงตะกร้า
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

