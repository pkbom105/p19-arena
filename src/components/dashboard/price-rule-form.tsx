'use client'

import { useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PriceRule } from '@/lib/price'
import { DAY_OPTIONS } from './helpers'

interface PriceRuleFormProps {
  initial: Partial<PriceRule>
  onSave: (data: Partial<PriceRule>) => void
  onCancel: () => void
  saving: boolean
}

/** ฟอร์มเพิ่ม/แก้ไขช่วงราคาตามช่วงเวลาและวัน — ใช้ในหน้า Dashboard → Court */
export function PriceRuleForm({ initial, onSave, onCancel, saving }: PriceRuleFormProps) {
  const [form, setForm] = useState({
    name: initial.name || '',
    days: initial.days || '',
    startTime: initial.startTime || '08:00',
    endTime: initial.endTime || '18:00',
    price: initial.price || 300,
    sortOrder: initial.sortOrder || 0,
  })

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const current = prev.days === '' ? [] : prev.days.split(',')
      if (current.includes(day)) {
        return { ...prev, days: current.filter((d) => d !== day).join(',') }
      }
      return { ...prev, days: [...current, day].sort((a, b) => Number(a) - Number(b)).join(',') }
    })
  }

  const toggleAllDays = () => {
    setForm((prev) => {
      const isAll = prev.days === '0,1,2,3,4,5,6'
      return { ...prev, days: isAll ? '' : '0,1,2,3,4,5,6' }
    })
  }

  const submit = () =>
    onSave({
      ...initial,
      name: form.name,
      days: form.days,
      startTime: form.startTime,
      endTime: form.endTime,
      price: parseInt(String(form.price)) || 0,
      sortOrder: form.sortOrder,
    })

  const selectedDayList = form.days === '' ? [] : form.days.split(',')
  const isAllSelected = form.days === '0,1,2,3,4,5,6'

  return (
    <div className="space-y-3 p-3 bg-violet-50/50 rounded-lg border border-violet-300">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ชื่อช่วงราคา (ไม่จำเป็น)</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="เช่น ชั่วโมงเร่งด่วน / วันเสาร์-อาทิตย์"
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">วันในสัปดาห์</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-violet-600"
              onClick={toggleAllDays}
            >
              {isAllSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทุกวัน'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
            {DAY_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={selectedDayList.includes(o.value)}
                  onCheckedChange={() => toggleDay(o.value)}
                  className="h-4 w-4"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {form.days === '' && (
            <p className="text-[11px] text-muted-foreground">
              ไม่ได้เลือก = ใช้กับทุกวัน
            </p>
          )}
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ราคา/ชม. (บาท)</Label>
          <Input
            type="number"
            value={form.price}
            onChange={(e) => setForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ช่วงเวลา</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
              className="h-8 text-sm flex-1 min-w-0"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
              className="h-8 text-sm flex-1 min-w-0"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
          onClick={submit}
          disabled={saving || !form.startTime || !form.endTime || Number(form.price) <= 0}
        >
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
