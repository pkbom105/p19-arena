'use client'

import { useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Equipment } from './types'

interface EquipmentFormProps {
  initial: Partial<Equipment>
  onSave: (data: Partial<Equipment>) => void
  onCancel: () => void
  saving: boolean
}

/** ฟอร์มเพิ่ม/แก้ไขอุปกรณ์ให้เช่า — ใช้ในหน้า Dashboard → Equipment */
export function EquipmentForm({ initial, onSave, onCancel, saving }: EquipmentFormProps) {
  const [form, setForm] = useState({
    name: initial.name || '',
    nameEn: initial.nameEn || '',
    pricePerUnit: initial.pricePerUnit || 0,
    sortOrder: initial.sortOrder || 0,
  })

  return (
    <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-200">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ชื่ออุปกรณ์ (ไทย)</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="แร็กเก็ตพิคเคิลบอล"
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ชื่ออุปกรณ์ (อังกฤษ)</Label>
          <Input
            value={form.nameEn}
            onChange={(e) => setForm(prev => ({ ...prev, nameEn: e.target.value }))}
            placeholder="Pickleball Racket"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ราคา/ชิ้น</Label>
          <Input
            type="number"
            value={form.pricePerUnit}
            onChange={(e) => setForm(prev => ({ ...prev, pricePerUnit: parseInt(e.target.value) || 0 }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ลำดับ</Label>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
          onClick={() => onSave({ ...initial, ...form })}
          disabled={saving || !form.name.trim()}
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
