'use client'

import { useState } from 'react'
import { ChevronDown, Loader2, Pencil, Plus, Power, Save, Trash2, Wrench, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Equipment } from './types'

interface EquipmentSectionProps {
  equipment: Equipment[]
  /** เรียกหลังบันทึก/ลบสำเร็จ — ให้หน้าแม่โหลดอุปกรณ์ใหม่ */
  onChanged: () => void | Promise<void>
}

interface EquipmentFormState {
  name: string
  nameEn: string
  pricePerUnit: number
  sortOrder: number
}

const EMPTY_FORM: EquipmentFormState = { name: '', nameEn: '', pricePerUnit: 50, sortOrder: 0 }

/** อุปกรณ์ให้เช่า — เพิ่ม/แก้ไข/ลบ (UI แบบเดียวกับหมวดสินค้า POS) */
export function EquipmentSection({ equipment, onChanged }: EquipmentSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EquipmentFormState>(EMPTY_FORM)
  const [newForm, setNewForm] = useState<EquipmentFormState>(EMPTY_FORM)

  const startEdit = (e: Equipment) => {
    setShowNew(false)
    setEditingId(e.id)
    setForm({ name: e.name, nameEn: e.nameEn || '', pricePerUnit: e.pricePerUnit, sortOrder: e.sortOrder })
  }

  /** บันทึกการแก้ไข (PUT /api/equipment) แล้วให้หน้าแม่โหลดใหม่ */
  const save = async (id: string) => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/equipment'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: form.name.trim(),
          nameEn: form.nameEn.trim() || null,
          pricePerUnit: Number(form.pricePerUnit) || 0,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      })
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ')
      toast.success(`บันทึกอุปกรณ์ "${form.name.trim()}" แล้ว`)
      setEditingId(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  /** เพิ่มอุปกรณ์ใหม่ (POST /api/equipment) */
  const create = async () => {
    if (!newForm.name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/equipment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newForm.name.trim(),
          nameEn: newForm.nameEn.trim() || null,
          pricePerUnit: Number(newForm.pricePerUnit) || 0,
          sortOrder: Number(newForm.sortOrder) || 0,
        }),
      })
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ')
      toast.success(`เพิ่มอุปกรณ์ "${newForm.name.trim()}" แล้ว`)
      setShowNew(false)
      setNewForm(EMPTY_FORM)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  /** เปิด-ปิดใช้งาน (soft — ไม่ลบแถว) */
  const toggleActive = async (e: Equipment) => {
    try {
      const res = await fetch(apiUrl('/api/equipment'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id, isActive: !e.isActive }),
      })
      if (!res.ok) throw new Error('อัปเดตสถานะไม่สำเร็จ')
      toast.success(e.isActive ? `ปิดใช้งาน "${e.name}" แล้ว` : `เปิดใช้งาน "${e.name}" แล้ว`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ')
    }
  }

  /** ลบถาวร (hard delete) */
  const remove = async (e: Equipment) => {
    if (!confirm(`ต้องการลบ "${e.name}" ถาวร?`)) return
    try {
      await fetch(apiUrl(`/api/equipment?id=${encodeURIComponent(e.id)}&hard=1`), { method: 'DELETE' })
      toast.success('ลบอุปกรณ์ถาวรแล้ว')
      if (editingId === e.id) setEditingId(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-emerald-600" /> อุปกรณ์เช่า
            <Badge variant="secondary" className="text-xs">ทั้งหมด {equipment.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              แก้ชื่อ/ราคา/ลำดับได้ · ลบ = ปิดใช้งาน (ไม่ลบข้อมูล)
            </span>
            <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={() => { setEditingId(null); setShowNew(true) }}>
              <Plus className="mr-1 h-3 w-3" /> เพิ่มอุปกรณ์
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* ฟอร์มเพิ่มอุปกรณ์ใหม่ */}
        {showNew && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="eq-new-name">ชื่ออุปกรณ์ (ไทย) *</Label>
                <Input id="eq-new-name" aria-label="ชื่ออุปกรณ์ใหม่ (ไทย)" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="แร็กเก็ตพิคเคิลบอล" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="eq-new-name-en">ชื่ออุปกรณ์ (อังกฤษ)</Label>
                <Input id="eq-new-name-en" aria-label="ชื่ออุปกรณ์ใหม่ (อังกฤษ)" value={newForm.nameEn} onChange={(e) => setNewForm({ ...newForm, nameEn: e.target.value })} placeholder="Pickleball Racket" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="eq-new-price">ราคา/ชิ้น</Label>
                <Input id="eq-new-price" aria-label="ราคาอุปกรณ์ใหม่" type="number" value={newForm.pricePerUnit} onChange={(e) => setNewForm({ ...newForm, pricePerUnit: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="eq-new-order">ลำดับการแสดง</Label>
                <Input id="eq-new-order" aria-label="ลำดับอุปกรณ์ใหม่" type="number" value={newForm.sortOrder} onChange={(e) => setNewForm({ ...newForm, sortOrder: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={create} disabled={saving || !newForm.name.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} บันทึก
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNew(false)}>
                <X className="mr-1 h-3 w-3" /> ยกเลิก
              </Button>
            </div>
          </div>
        )}

        {equipment.length === 0 && !showNew && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีอุปกรณ์เช่า — กด &quot;เพิ่มอุปกรณ์&quot; ด้านบน
          </p>
        )}

          {equipment.map((item) => (
            <Collapsible
              key={item.id}
              open={editingId === item.id}
              onOpenChange={(next) => (next ? startEdit(item) : setEditingId(null))}
              className={`rounded-lg border p-2 ${item.isActive ? 'bg-muted/20' : 'bg-muted/40 opacity-70'} ${editingId === item.id ? 'border-emerald-300' : ''}`}
            >
              <div data-slot="equipment-row" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="shrink-0 text-xl leading-none">🏸</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {item.nameEn || '—'} · ฿{item.pricePerUnit.toLocaleString()}/ชิ้น · ลำดับ {item.sortOrder}
                  </div>
                </div>
                <Badge
                  variant={item.isActive ? 'secondary' : 'outline'}
                  className={'shrink-0 text-[10px] ' + (item.isActive ? 'border-amber-300 bg-amber-100 text-amber-800' : '')}
                >
                  {item.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs" aria-label={`แก้ไขอุปกรณ์ ${item.name}`}>
                      <Pencil className="mr-1 h-3 w-3" /> แก้ไข
                      <ChevronDown className={'ml-1 h-3 w-3 transition-transform ' + (editingId === item.id ? 'rotate-180' : '')} />
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    variant={item.isActive ? 'ghost' : 'outline'}
                    className={`h-7 text-xs ${item.isActive ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-emerald-700'}`}
                    aria-label={item.isActive ? `ปิดใช้งานอุปกรณ์ ${item.name}` : `เปิดใช้งานอุปกรณ์ ${item.name}`}
                    onClick={() => toggleActive(item)}
                  >
                    <Power className="mr-1 h-3 w-3" /> {item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50" aria-label={`ลบอุปกรณ์ ${item.name} ถาวร`} onClick={() => remove(item)}>
                    <Trash2 className="mr-1 h-3 w-3" /> ลบ
                  </Button>
                </div>
              </div>

              {/* ฟอร์มแก้ไขกางออกใต้แถวนี้เท่านั้น (Collapsible ของ shadcn) */}
              <CollapsibleContent>
                <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`eq-name-${item.id}`}>ชื่ออุปกรณ์ (ไทย) *</Label>
                      <Input id={`eq-name-${item.id}`} aria-label="ชื่ออุปกรณ์ (ไทย)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`eq-name-en-${item.id}`}>ชื่ออุปกรณ์ (อังกฤษ)</Label>
                      <Input id={`eq-name-en-${item.id}`} aria-label="ชื่ออุปกรณ์ (อังกฤษ)" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`eq-price-${item.id}`}>ราคา/ชิ้น</Label>
                      <Input id={`eq-price-${item.id}`} aria-label="ราคาอุปกรณ์" type="number" value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`eq-order-${item.id}`}>ลำดับการแสดง</Label>
                      <Input id={`eq-order-${item.id}`} aria-label="ลำดับอุปกรณ์" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700" aria-label={`บันทึกอุปกรณ์ ${item.name}`} onClick={() => save(item.id)} disabled={saving || !form.name.trim()}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} บันทึก
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                      <X className="mr-1 h-3 w-3" /> ยกเลิก
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

      </CardContent>
    </Card>
  )
}
