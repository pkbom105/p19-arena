'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ShopCategory } from '@/components/pos-shop/types'

/**
 * ปุ่ม "＋ เพิ่มหมวด" + ฟอร์มเพิ่มหมวดสินค้าใหม่ — บันทึกลงตาราง ShopCategory
 * หมวดใหม่จะถูกใช้กับสินค้าที่เพิ่มในอนาคต (และโผล่ในแท็บกรองหน้าแคชเชียร์ด้วย)
 */
export function CategoryDialog({ onCreated }: { onCreated: (category: ShopCategory) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ label: '', labelEn: '', emoji: '' })

  const reset = () => setForm({ label: '', labelEn: '', emoji: '' })

  const handleSave = async () => {
    if (!form.label.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/shop-categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'เพิ่มหมวดไม่สำเร็จ')

      const created = json as ShopCategory
      onCreated(created)
      toast.success(`เพิ่มหมวด "${created.label}" แล้ว`)
      reset()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เพิ่มหมวดไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" aria-label="เพิ่มหมวด">
          <Plus className="mr-1 h-3 w-3" /> เพิ่มหมวด
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มหมวดสินค้า</DialogTitle>
          <DialogDescription>
            หมวดใหม่จะใช้กับสินค้าที่จะเพิ่มในอนาคต และโผล่เป็นแท็บในหน้าแคชเชียร์ทันที
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="cat-label">ชื่อหมวด (ไทย) *</Label>
            <Input
              id="cat-label"
              aria-label="ชื่อหมวด (ไทย)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="ของเล่น / อุปกรณ์เสริม"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="cat-label-en">ชื่อหมวด (อังกฤษ)</Label>
            <Input
              id="cat-label-en"
              aria-label="ชื่อหมวด (อังกฤษ)"
              value={form.labelEn}
              onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
              placeholder="Toys / Accessories"
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              ชื่ออังกฤษถูกใช้เป็นรหัสหมวด (a-z) — ถ้าเว้นว่างระบบจะสร้างรหัสให้อัตโนมัติ
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="cat-emoji">ไอคอน (emoji)</Label>
            <Input
              id="cat-emoji"
              aria-label="ไอคอนหมวด"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder="🧸"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs">ยกเลิก</Button>
          </DialogClose>
          <Button
            size="sm"
            className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700"
            onClick={handleSave}
            disabled={saving || !form.label.trim()}
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            บันทึกหมวด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
