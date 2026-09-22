'use client'

import { useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Court } from './types'

interface CourtFormProps {
  initial: Partial<Court>
  onSave: (data: Partial<Court>) => void
  onCancel: () => void
  saving: boolean
}

/** ฟอร์มเพิ่ม/แก้ไขสนาม — ใช้ในหน้า Dashboard → Court */
export function CourtForm({ initial, onSave, onCancel, saving }: CourtFormProps) {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    sortOrder: initial.sortOrder || 0,
  })

  return (
    <div className="space-y-2 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">ชื่อสนาม</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="สนาม 1"
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">รายละเอียด</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="P19 Pickleball Court A"
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
