'use client'

import { useState } from 'react'
import { ChevronDown, Loader2, Pencil, Power, Save, Tags, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ShopCategoryRow } from '@/components/pos-shop/types'
import { PermanentDeleteButton } from './permanent-delete-button'

interface CategoryListProps {
  categories: ShopCategoryRow[]
  /** เรียกหลังบันทึกสำเร็จ — ให้หน้าแม่โหลดหมวดใหม่ (แท็บ/ป้ายชื่อหมวดอัปเดตตาม) */
  onUpdated: () => void | Promise<void>
}

/** การ์ดจัดการหมวดสินค้า (อยู่ใต้ list สินค้า) — แก้ชื่อ/อิโมจิ/ลำดับ และเปิด-ปิดใช้งาน (ไม่ลบข้อมูล) */
export function CategoryList({ categories, onUpdated }: CategoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ label: '', labelEn: '', emoji: '', sortOrder: 0 })

  const startEdit = (c: ShopCategoryRow) => {
    setEditingId(c.id)
    setForm({ label: c.label, labelEn: c.labelEn, emoji: c.emoji, sortOrder: c.sortOrder })
  }

  /** บันทึกการแก้ไขหมวด (PUT /api/shop-categories) แล้วให้หน้าแม่โหลดหมวดใหม่ */
  const save = async (id: string) => {
    if (!form.label.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/shop-categories'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form, sortOrder: Number(form.sortOrder) || 0 }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ')
      toast.success(`บันทึกหมวด "${form.label.trim()}" แล้ว`)
      setEditingId(null)
      await onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  /** เปิด-ปิดใช้งานหมวด (soft — ไม่ลบแถว เพราะสินค้าเดิมอ้างอิง id นี้) */
  const toggleActive = async (c: ShopCategoryRow) => {
    try {
      const res = await fetch(apiUrl('/api/shop-categories'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, isActive: !c.isActive }),
      })
      if (!res.ok) throw new Error('อัปเดตสถานะไม่สำเร็จ')
      toast.success(c.isActive ? `ปิดใช้งานหมวด "${c.label}" แล้ว` : `เปิดใช้งานหมวด "${c.label}" แล้ว`)
      await onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ')
    }
  }

  /** ลบถาวร (เฉพาะหมวดที่ปิดใช้งานแล้ว) — API จะปฏิเสธถ้ายังมีสินค้าใช้หมวดนี้อยู่ */
  const deletePermanent = async (c: ShopCategoryRow) => {
    try {
      const res = await fetch(apiUrl(`/api/shop-categories?id=${encodeURIComponent(c.id)}`), { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'ลบไม่สำเร็จ')
      toast.success(`ลบหมวด "${c.label}" ออกจากฐานข้อมูลแล้ว`)
      if (editingId === c.id) setEditingId(null)
      await onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
      throw err
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4 text-emerald-600" /> หมวดสินค้า (POS)
            <Badge variant="secondary" className="text-xs">ทั้งหมด {categories.length}</Badge>
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">
            แก้ชื่อ/อิโมจิ/ลำดับได้ · ปิดใช้งาน = ซ่อนจากหน้าแคชเชียร์ (ไม่ลบข้อมูล)
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีหมวดสินค้า — กด &quot;เพิ่มหมวด&quot; ในหัวการ์ดสินค้าด้านบน
          </p>
        ) : (
          categories.map((c) => (
            <Collapsible
              key={c.id}
              open={editingId === c.id}
              onOpenChange={(next) => (next ? startEdit(c) : setEditingId(null))}
              className={`rounded-lg border p-2 ${c.isActive ? 'bg-muted/20' : 'bg-muted/40 opacity-70'} ${editingId === c.id ? 'border-emerald-300' : ''}`}
            >
              <div data-slot="category-row" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="shrink-0 text-xl leading-none">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {c.labelEn || '—'} · รหัส {c.id} · ลำดับ {c.sortOrder}
                  </div>
                </div>
                <Badge
                  variant={c.isActive ? 'secondary' : 'outline'}
                  className={'shrink-0 text-[10px] ' + (c.isActive ? 'border-amber-300 bg-amber-100 text-amber-800' : '')}
                >
                  {c.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      aria-label={`แก้ไขหมวด ${c.label}`}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> แก้ไข
                      <ChevronDown className={'ml-1 h-3 w-3 transition-transform ' + (editingId === c.id ? 'rotate-180' : '')} />
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    variant={c.isActive ? 'ghost' : 'outline'}
                    className={`h-7 text-xs ${c.isActive ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-emerald-700'}`}
                    aria-label={c.isActive ? `ปิดใช้งานหมวด ${c.label}` : `เปิดใช้งานหมวด ${c.label}`}
                    onClick={() => toggleActive(c)}
                  >
                    <Power className="mr-1 h-3 w-3" /> {c.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                  <PermanentDeleteButton kind="หมวด" label={c.label} onConfirm={() => deletePermanent(c)} />
                </div>
              </div>

              {/* ฟอร์มแก้ไขกางออกใต้แถวนี้เท่านั้น (Collapsible ของ shadcn) */}
              <CollapsibleContent>
                <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`cat-label-${c.id}`}>ชื่อหมวด (ไทย) *</Label>
                      <Input
                        id={`cat-label-${c.id}`}
                        aria-label="ชื่อหมวด (ไทย)"
                        value={form.label}
                        onChange={(e) => setForm({ ...form, label: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`cat-label-en-${c.id}`}>ชื่อหมวด (อังกฤษ)</Label>
                      <Input
                        id={`cat-label-en-${c.id}`}
                        aria-label="ชื่อหมวด (อังกฤษ)"
                        value={form.labelEn}
                        onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`cat-emoji-${c.id}`}>ไอคอน (emoji)</Label>
                      <Input
                        id={`cat-emoji-${c.id}`}
                        aria-label="ไอคอนหมวด"
                        value={form.emoji}
                        onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`cat-order-${c.id}`}>ลำดับการแสดง</Label>
                      <Input
                        id={`cat-order-${c.id}`}
                        aria-label="ลำดับหมวด"
                        type="number"
                        value={form.sortOrder}
                        onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700"
                      aria-label={`บันทึกหมวด ${c.label}`}
                      onClick={() => save(c.id)}
                      disabled={saving || !form.label.trim()}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} บันทึก
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                      <X className="mr-1 h-3 w-3" /> ยกเลิก
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </CardContent>
    </Card>
  )
}
