'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Plus } from 'lucide-react'
import { getSlotPrice, type PriceRule } from '@/lib/price'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiUrl } from '@/lib/api'
import { toast } from 'sonner'
import { SLOT_GRACE_MINUTES, isSlotPassed, isSlotStarted, slotCloseTime } from '@/lib/slot-time'
import { formatThaiDate } from './helpers'
import type { BookingRow, Court, NewBookingPreset, TimeSlotItem } from './types'

interface NewBookingDialogProps {
  preset: NewBookingPreset
  courts: Court[]
  timeSlots: TimeSlotItem[]
  activeBookings: BookingRow[]
  priceRules: PriceRule[]
  todayStr: string
  maxDateStr: string
  onClose: () => void
  onSaved: () => void
}

/** Dialog จองใหม่ (หน้าเคาน์เตอร์) — สถานะเริ่มต้น "ยืนยันแล้ว" (ชำระที่เคาน์เตอร์) */
export function NewBookingDialog({
  preset, courts, timeSlots, activeBookings, priceRules, todayStr, maxDateStr, onClose, onSaved,
}: NewBookingDialogProps) {
  const [form, setForm] = useState({
    bookingDate: preset.bookingDate,
    courtId: preset.courtId || courts[0]?.id || '',
    timeSlotId: preset.timeSlotId || '',
    playerName: '',
    playerPhone: '',
    playerEmail: '',
    note: '',
    racketCount: 0,
    status: 'confirmed',
  })
  const [saving, setSaving] = useState(false)
  // เดินเวลาเองทุก 30 วิ — เวลาผ่อนผัน 20 นาทีหลังเริ่มช่วงเวลา (จองได้ถึง 14:20 ของ slot 14:00)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const dayOfWeek = form.bookingDate ? new Date(form.bookingDate + 'T00:00:00').getDay() : null
  const slots = timeSlots
    .filter((t) => t.isActive && (dayOfWeek === null || t.dayOfWeek === dayOfWeek))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  // ช่องที่ถูกจอง (active) ของสนาม/วันที่ที่เลือก
  const isTaken = (slotId: string) =>
    activeBookings.some((b) => b.courtId === form.courtId && b.bookingDate === form.bookingDate && b.timeSlotId === slotId)
  const selectedCourt = courts.find((c) => c.id === form.courtId)
  const selectedSlot = timeSlots.find((s) => s.id === form.timeSlotId)
  const price =
    selectedCourt && selectedSlot && dayOfWeek !== null
      ? getSlotPrice(selectedCourt.pricePerHour, dayOfWeek, selectedSlot.startTime, priceRules)
      : null
  const outOfRange = !form.bookingDate || form.bookingDate < todayStr || form.bookingDate > maxDateStr
  // ช่องที่เลือกปิดรับจองแล้ว (เลย startTime + 20 นาที) — กันส่งไป server ตอนเวลาข้ามช่องที่เลือกไว้
  const slotPassed = !!(form.bookingDate && selectedSlot && isSlotPassed(form.bookingDate, selectedSlot.startTime, now))
  // เริ่มช่วงเวลาแล้วแต่ยังจองได้ (อยู่ในเวลาผ่อนผัน) → แสดงเตือน
  const slotStarted = !!(form.bookingDate && selectedSlot && !slotPassed && isSlotStarted(form.bookingDate, selectedSlot.startTime, now))
  const canSubmit = !saving && !outOfRange && !slotPassed && !!form.courtId && !!form.timeSlotId && !!form.playerName.trim() && !!form.playerPhone.trim()

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/bookings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: form.courtId,
          timeSlotId: form.timeSlotId,
          bookingDate: form.bookingDate,
          playerName: form.playerName.trim(),
          playerPhone: form.playerPhone.trim(),
          playerEmail: form.playerEmail.trim() || undefined,
          note: form.note.trim() || undefined,
          racketCount: Number(form.racketCount) || 0,
          status: form.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'จองไม่สำเร็จ')
        return
      }
      toast.success(`จองสำเร็จ — รหัสตั๋ว #${String(data.ticketCode || data.id).toUpperCase()}`)
      onSaved()
      onClose()
    } catch {
      toast.error('จองไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" /> จองสนาม (หน้าเคาน์เตอร์)
          </DialogTitle>
          <DialogDescription>
            บันทึกการจองให้ลูกค้า — สถานะเริ่มต้น &quot;ยืนยันแล้ว&quot; (ชำระที่เคาน์เตอร์)
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">วันที่</Label>
            <Input
              type="date"
              value={form.bookingDate}
              min={todayStr}
              max={maxDateStr}
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
              {slots.length === 0 && <option value="">ไม่มีช่วงเวลาของวันนี้</option>}
              {slots.map((s) => {
                const taken = isTaken(s.id)
                const passed = isSlotPassed(form.bookingDate, s.startTime, now)
                const started = !passed && isSlotStarted(form.bookingDate, s.startTime, now)
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
            <Label className="text-xs">ชื่อผู้เล่น *</Label>
            <Input value={form.playerName} onChange={(e) => setForm((prev) => ({ ...prev, playerName: e.target.value }))} placeholder="ชื่อ-นามสกุล" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">เบอร์โทร *</Label>
            <Input value={form.playerPhone} onChange={(e) => setForm((prev) => ({ ...prev, playerPhone: e.target.value }))} placeholder="08x-xxx-xxxx" className="h-9 text-sm" />
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

        {outOfRange && (
          <p className="text-xs text-red-600">จองได้ตั้งแต่วันนี้ ถึง {formatThaiDate(maxDateStr)} เท่านั้น</p>
        )}
        {slotPassed && (
          <p className="text-xs text-red-600">ช่วงเวลานี้ปิดรับจองแล้ว — รับจองถึง {SLOT_GRACE_MINUTES} นาทีหลังเริ่มเวลา (ปิด {selectedSlot ? slotCloseTime(form.bookingDate, selectedSlot.startTime) : ''} น.)</p>
        )}
        {slotStarted && (
          <p className="flex items-center gap-1 text-xs font-medium text-orange-600">
            <AlertTriangle className="h-3.5 w-3.5" /> เริ่มช่วงเวลาแล้ว — ยังจองได้ (ปิดรับจอง {selectedSlot ? slotCloseTime(form.bookingDate, selectedSlot.startTime) : ''} น.)
          </p>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">ปิด</Button>
          </DialogClose>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={!canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            ยืนยันการจอง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
