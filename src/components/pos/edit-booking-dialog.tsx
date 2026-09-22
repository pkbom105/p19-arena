'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Pencil } from 'lucide-react'
import { getSlotPrice, type PriceRule } from '@/lib/price'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiUrl } from '@/lib/api'
import { toast } from 'sonner'
import { SLOT_GRACE_MINUTES, isSlotPassed, isSlotStarted, slotCloseTime } from '@/lib/slot-time'
import type { BookingRow, Court, TimeSlotItem } from './types'

interface EditBookingDialogProps {
  booking: BookingRow
  courts: Court[]
  timeSlots: TimeSlotItem[]
  activeBookings: BookingRow[]
  priceRules: PriceRule[]
  todayStr: string
  onClose: () => void
  onSaved: () => void
}

/** Dialog แก้ไขการจอง — เลื่อนวัน/เวลา/สนาม หรือเปลี่ยนสถานะการชำระเงิน */
export function EditBookingDialog({
  booking, courts, timeSlots, activeBookings, priceRules, todayStr, onClose, onSaved,
}: EditBookingDialogProps) {
  const [form, setForm] = useState({
    bookingDate: booking.bookingDate,
    courtId: booking.courtId,
    timeSlotId: booking.timeSlotId,
    playerName: booking.playerName,
    playerPhone: booking.playerPhone,
    playerEmail: booking.playerEmail || '',
    note: booking.note || '',
    racketCount: booking.racketCount || 0,
    status: booking.status,
  })
  const [saving, setSaving] = useState(false)
  // เดินเวลาเองทุก 30 วิ — เวลาผ่อนผัน 20 นาทีหลังเริ่มช่วงเวลา (ย้ายไป slot 14:00 ได้ถึง 14:20)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const dayOfWeek = form.bookingDate ? new Date(form.bookingDate + 'T00:00:00').getDay() : null
  const slots = timeSlots
    .filter((t) => t.isActive && (dayOfWeek === null || t.dayOfWeek === dayOfWeek))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  // ช่องที่ถูกจองโดยการจอง "อื่น" (ตัวเองไม่นับเป็น conflict)
  const isTaken = (slotId: string) =>
    activeBookings.some((b) => b.id !== booking.id && b.courtId === form.courtId && b.bookingDate === form.bookingDate && b.timeSlotId === slotId)
  const selectedCourt = courts.find((c) => c.id === form.courtId)
  const selectedSlot = timeSlots.find((s) => s.id === form.timeSlotId)
  const price =
    selectedCourt && selectedSlot && dayOfWeek !== null
      ? getSlotPrice(selectedCourt.pricePerHour, dayOfWeek, selectedSlot.startTime, priceRules)
      : null
  // ย้ายไปวันที่ผ่านมาแล้ว = ไม่อนุญาต (แก้ไขข้อมูลอื่นของ booking เดิมที่เป็นอดีตยังทำได้)
  const movedToPast = !!form.bookingDate && form.bookingDate < todayStr && form.bookingDate !== booking.bookingDate
  // ยังเป็นวัน/เวลาเดิมของ booking นี้ (แก้ไขข้อมูลอื่นได้แม้เวลาผ่านไปแล้ว)
  const stillOriginal = form.bookingDate === booking.bookingDate && form.timeSlotId === booking.timeSlotId
  // เลือกช่วงเวลาที่ปิดรับจองแล้ว (เลย startTime + 20 นาที) — ยกเว้นช่องเดิมที่ยังไม่ถูกแก้
  const targetPassed = !stillOriginal && !!selectedSlot && isSlotPassed(form.bookingDate, selectedSlot.startTime, now)
  // ปลายทางเริ่มช่วงเวลาแล้วแต่ยังจองได้ (อยู่ในเวลาผ่อนผัน) → แสดงเตือน
  const targetStarted = !stillOriginal && !targetPassed && !!selectedSlot && isSlotStarted(form.bookingDate, selectedSlot.startTime, now)
  const canSubmit =
    !saving &&
    !movedToPast &&
    !targetPassed &&
    !!form.bookingDate &&
    !!form.courtId &&
    !!form.timeSlotId &&
    !isTaken(form.timeSlotId) &&
    !!form.playerName.trim() &&
    !!form.playerPhone.trim()

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/bookings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: booking.id,
          bookingDate: form.bookingDate,
          courtId: form.courtId,
          timeSlotId: form.timeSlotId,
          playerName: form.playerName.trim(),
          playerPhone: form.playerPhone.trim(),
          playerEmail: form.playerEmail.trim(),
          note: form.note.trim(),
          racketCount: Number(form.racketCount) || 0,
          status: form.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'อัปเดตการจองไม่สำเร็จ')
        return
      }
      toast.success('อัปเดตการจองสำเร็จ')
      onSaved()
      onClose()
    } catch {
      toast.error('อัปเดตการจองไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-emerald-600" /> แก้ไขการจอง #{String(booking.ticketCode || booking.id).toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            เลื่อนวัน/เวลา/สนาม หรือเปลี่ยนสถานะการชำระเงินได้
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">วันที่</Label>
            <Input
              type="date"
              value={form.bookingDate}
              onChange={(e) => setForm((prev) => ({ ...prev, bookingDate: e.target.value, timeSlotId: '' }))}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">สนาม</Label>
            <select
              value={form.courtId}
              onChange={(e) => setForm((prev) => ({ ...prev, courtId: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">เวลา</Label>
            <select
              value={form.timeSlotId}
              onChange={(e) => setForm((prev) => ({ ...prev, timeSlotId: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {!form.timeSlotId && <option value="">— เลือกช่วงเวลา —</option>}
              {slots.map((s) => {
                const taken = isTaken(s.id)
                // ช่องปิดรับจองแล้ว → เลือกไม่ได้ (ยกเว้นช่องเดิมของวันเดิม เพื่อแก้ไขข้อมูลอื่นของ booking ในอดีตได้)
                const originalSlot = s.id === booking.timeSlotId && form.bookingDate === booking.bookingDate
                const passed = !originalSlot && isSlotPassed(form.bookingDate, s.startTime, now)
                const started = !passed && !originalSlot && isSlotStarted(form.bookingDate, s.startTime, now)
                return (
                  <option key={s.id} value={s.id} disabled={taken || passed}>
                    {s.startTime} - {s.endTime}
                    {taken ? ' (จองแล้ว)' : passed ? ' (ปิดรับจองแล้ว)' : started ? ' (เริ่มแล้ว)' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">ชื่อผู้เล่น</Label>
            <Input value={form.playerName} onChange={(e) => setForm((prev) => ({ ...prev, playerName: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">เบอร์โทร</Label>
            <Input value={form.playerPhone} onChange={(e) => setForm((prev) => ({ ...prev, playerPhone: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">สถานะ</Label>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="confirmed">ยืนยันแล้ว (ชำระแล้ว)</option>
              <option value="pending">รอชำระ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">จำนวนไม้เช่า</Label>
            <Input type="number" min={0} value={form.racketCount} onChange={(e) => setForm((prev) => ({ ...prev, racketCount: parseInt(e.target.value) || 0 }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ราคา</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold text-emerald-700">
              {price !== null ? `฿${price.toLocaleString()}` : '—'}
            </div>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">อีเมล (ไม่จำเป็น)</Label>
            <Input value={form.playerEmail} onChange={(e) => setForm((prev) => ({ ...prev, playerEmail: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">หมายเหตุ (ไม่จำเป็น)</Label>
            <Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} className="h-9 text-sm" />
          </div>
        </div>

        {movedToPast && (
          <p className="text-xs text-red-600">ไม่สามารถย้ายการจองไปวันที่ผ่านมาแล้ว</p>
        )}
        {targetPassed && (
          <p className="text-xs text-red-600">ไม่สามารถย้ายการจองไปช่วงเวลาที่ปิดรับจองแล้วได้ — รับจองถึง {SLOT_GRACE_MINUTES} นาทีหลังเริ่มเวลา</p>
        )}
        {targetStarted && (
          <p className="text-xs font-medium text-orange-600">
            ช่วงเวลาใหม่เริ่มแล้ว — ยังย้ายได้ (ปิดรับจอง {selectedSlot ? slotCloseTime(form.bookingDate, selectedSlot.startTime) : ''} น.)
          </p>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">ปิด</Button>
          </DialogClose>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={!canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            บันทึกการแก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
