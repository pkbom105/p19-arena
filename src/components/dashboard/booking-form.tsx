'use client'

import { useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BookingRow, Court, TimeSlotItem } from './types'

interface BookingFormProps {
  initial: BookingRow
  courts: Court[]
  timeSlots: TimeSlotItem[]
  onSave: (data: Partial<BookingRow>) => void
  onCancel: () => void
  saving: boolean
}

/** ฟอร์มแก้ไขการจองของลูกค้า — ใช้ในหน้า Dashboard → Booking Tickets */
export function BookingForm({ initial, courts, timeSlots, onSave, onCancel, saving }: BookingFormProps) {
  const [form, setForm] = useState({
    bookingDate: initial.bookingDate,
    courtId: initial.courtId,
    timeSlotId: initial.timeSlotId,
    playerName: initial.playerName || '',
    playerPhone: initial.playerPhone || '',
    playerEmail: initial.playerEmail || '',
    note: initial.note || '',
  })

  // Time slots that belong to the selected booking date's day of week
  const selectedDayOfWeek = form.bookingDate ? new Date(form.bookingDate + 'T00:00:00').getDay() : null
  const availableSlots = timeSlots.filter((t) => (selectedDayOfWeek === null ? true : t.dayOfWeek === selectedDayOfWeek) && t.isActive)

  const submit = () =>
    onSave({
      id: initial.id,
      bookingDate: form.bookingDate,
      courtId: form.courtId,
      timeSlotId: form.timeSlotId,
      playerName: form.playerName,
      playerPhone: form.playerPhone,
      playerEmail: form.playerEmail,
      note: form.note,
    })

  return (
    <div className="space-y-3 p-3 bg-emerald-50/60 rounded-lg border border-emerald-300">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">วันที่</Label>
          <Input
            type="date"
            value={form.bookingDate}
            onChange={(e) => { setForm(prev => ({ ...prev, bookingDate: e.target.value, timeSlotId: '' })) }}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">สนาม</Label>
          <select
            value={form.courtId}
            onChange={(e) => setForm(prev => ({ ...prev, courtId: e.target.value }))}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            onChange={(e) => setForm(prev => ({ ...prev, timeSlotId: e.target.value }))}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {availableSlots.length === 0 && <option value="">ไม่มีช่องเวลาตรงกับวันที่นี้</option>}
            {availableSlots.map((s) => (
              <option key={s.id} value={s.id}>{s.startTime} - {s.endTime}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ชื่อ-นามสกุล</Label>
          <Input value={form.playerName} onChange={(e) => setForm(prev => ({ ...prev, playerName: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">เบอร์โทรศัพท์</Label>
          <Input value={form.playerPhone} onChange={(e) => setForm(prev => ({ ...prev, playerPhone: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">อีเมล (ไม่จำเป็น)</Label>
          <Input value={form.playerEmail} onChange={(e) => setForm(prev => ({ ...prev, playerEmail: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">หมายเหตุ (ไม่จำเป็น)</Label>
          <Input value={form.note} onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))} className="h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={saving || !form.bookingDate || !form.courtId || !form.playerName.trim() || !form.playerPhone.trim()}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          บันทึก
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> ยกเลิก
        </Button>
      </div>
    </div>
  )
}
