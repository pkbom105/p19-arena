'use client'

import { useState } from 'react'
import { CalendarDays, ChevronDown, GraduationCap, Loader2, Pencil, Plus, Power, Save, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface CoachRow {
  id: string
  name: string
  initial: string
  level: string
  pricePerHour: number
  experienceYears: number
  specialties: string
  availableDays: string
  rating: number
  isActive: boolean
  sortOrder: number
}

interface CoachListProps {
  coaches: CoachRow[]
  onChanged: () => void | Promise<void>
}

interface CoachFormState {
  name: string
  initial: string
  level: string
  pricePerHour: number
  experienceYears: number
  specialties: string
  availableDays: string
  rating: number
  sortOrder: number
}

const EMPTY_FORM: CoachFormState = {
  name: '', initial: '', level: '', pricePerHour: 0, experienceYears: 0,
  specialties: '', availableDays: '', rating: 0, sortOrder: 0,
}

const toForm = (c: CoachRow): CoachFormState => ({
  name: c.name, initial: c.initial, level: c.level, pricePerHour: c.pricePerHour,
  experienceYears: c.experienceYears, specialties: c.specialties,
  availableDays: c.availableDays, rating: c.rating, sortOrder: c.sortOrder,
})

const payload = (f: CoachFormState) => ({
  ...f,
  pricePerHour: Number(f.pricePerHour) || 0,
  experienceYears: Number(f.experienceYears) || 0,
  rating: Number(f.rating) || 0,
  sortOrder: Number(f.sortOrder) || 0,
  specialties: f.specialties.split(',').map((s) => s.trim()).filter(Boolean),
})

function CoachFormFields({ form, setForm, prefix }: {
  form: CoachFormState
  setForm: (f: CoachFormState) => void
  prefix: string
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-name`}>ชื่อโค้ช *</Label><Input id={`${prefix}-name`} aria-label="ชื่อโค้ช" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-sm" placeholder="โค้ชต้น (Coach Ton)" /></div>
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-initial`}>ตัวย่อ (avatar)</Label><Input id={`${prefix}-initial`} aria-label="ตัวย่อโค้ช" value={form.initial} onChange={(e) => setForm({ ...form, initial: e.target.value })} className="h-8 text-sm" /></div>
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-level`}>ระดับ</Label><Input id={`${prefix}-level`} aria-label="ระดับโค้ช" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="h-8 text-sm" placeholder="ระดับกลาง" /></div>
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-price`}>ราคา/ชม. (บาท)</Label><Input id={`${prefix}-price`} aria-label="ราคาโค้ชต่อชั่วโมง" type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: parseInt(e.target.value) || 0 })} className="h-8 text-sm" /></div>
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-years`}>ประสบการณ์ (ปี)</Label><Input id={`${prefix}-years`} aria-label="ปีประสบการณ์" type="number" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: parseInt(e.target.value) || 0 })} className="h-8 text-sm" /></div>
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-rating`}>คะแนน</Label><Input id={`${prefix}-rating`} aria-label="คะแนนโค้ช" type="number" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" /></div>
      <div className="space-y-1 sm:col-span-2"><Label className="text-xs" htmlFor={`${prefix}-specialties`}>ความเชี่ยวชาญ (คั่นด้วย comma)</Label><Input id={`${prefix}-specialties`} aria-label="ความเชี่ยวชาญ" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} className="h-8 text-sm" placeholder="พื้นฐานไม้, ฟุตเวิร์ก" /></div>
      <div className="space-y-1 sm:col-span-2"><Label className="text-xs" htmlFor={`${prefix}-days`}>วัน/เวลาว่าง</Label><Input id={`${prefix}-days`} aria-label="วันเวลาว่าง" value={form.availableDays} onChange={(e) => setForm({ ...form, availableDays: e.target.value })} className="h-8 text-sm" placeholder="จ.–ศ. 17:00–21:00" /></div>
      <div className="space-y-1"><Label className="text-xs" htmlFor={`${prefix}-order`}>ลำดับ</Label><Input id={`${prefix}-order`} aria-label="ลำดับโค้ช" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="h-8 text-sm" /></div>
    </div>
  )
}

/** รายชื่อโค้ช — แก้ไขได้ (เพิ่ม/แก้/เปิด-ปิด/ลบ) + วันที่/เวลาว่างสำหรับอ้างอิงตอนจัดตารางจอง */
export function CoachList({ coaches, onChanged }: CoachListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CoachFormState>(EMPTY_FORM)
  const [newForm, setNewForm] = useState<CoachFormState>(EMPTY_FORM)

  const startEdit = (c: CoachRow) => {
    setShowNew(false)
    setEditingId(c.id)
    setForm(toForm(c))
  }

  const save = async (id: string) => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/coaches'), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload(form) }),
      })
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ')
      toast.success(`บันทึกโค้ช "${form.name.trim()}" แล้ว`)
      setEditingId(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const create = async () => {
    if (!newForm.name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/coaches'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(newForm)),
      })
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ')
      toast.success(`เพิ่มโค้ช "${newForm.name.trim()}" แล้ว`)
      setShowNew(false)
      setNewForm(EMPTY_FORM)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (c: CoachRow) => {
    try {
      const res = await fetch(apiUrl('/api/coaches'), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, isActive: !c.isActive }),
      })
      if (!res.ok) throw new Error('อัปเดตสถานะไม่สำเร็จ')
      toast.success(c.isActive ? `ปิดใช้งาน "${c.name}" แล้ว` : `เปิดใช้งาน "${c.name}" แล้ว`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ')
    }
  }

  const remove = async (c: CoachRow) => {
    if (!confirm(`ต้องการลบ "${c.name}" ถาวร?`)) return
    try {
      await fetch(apiUrl(`/api/coaches?id=${encodeURIComponent(c.id)}&hard=1`), { method: 'DELETE' })
      toast.success('ลบโค้ชถาวรแล้ว')
      if (editingId === c.id) setEditingId(null)
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
            <GraduationCap className="h-4 w-4 text-emerald-600" /> โค้ช
            <Badge variant="secondary" className="text-xs">ทั้งหมด {coaches.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">วัน/เวลาว่าง = อ้างอิงตอนจัดตารางจอง</span>
            <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={() => { setEditingId(null); setShowNew(true) }}>
              <Plus className="mr-1 h-3 w-3" /> เพิ่มโค้ช
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {showNew && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-2">
            <CoachFormFields form={newForm} setForm={setNewForm} prefix="coach-new" />
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

        {coaches.length === 0 && !showNew ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีโค้ช — กด &quot;เพิ่มโค้ช&quot; ด้านบน</p>
        ) : (
          coaches.map((c) => (
            <Collapsible
              key={c.id}
              open={editingId === c.id}
              onOpenChange={(next) => (next ? startEdit(c) : setEditingId(null))}
              className={`rounded-lg border p-2 ${c.isActive ? 'bg-muted/20' : 'bg-muted/40 opacity-70'} ${editingId === c.id ? 'border-emerald-300' : ''}`}
            >
              <div data-slot="coach-row" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">{c.initial}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {c.level} · ฿{c.pricePerHour.toLocaleString()}/ชม. · {c.experienceYears} ปี
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> {c.availableDays}
                </span>
                <Badge variant="secondary" className={`shrink-0 text-[10px] ${c.isActive ? 'border-amber-300 bg-amber-100 text-amber-800' : ''}`}>
                  {c.isActive ? (<><Star className="mr-0.5 h-3 w-3" /> {c.rating}</>) : 'ปิดใช้งาน'}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs" aria-label={`แก้ไขโค้ช ${c.name}`}>
                      <Pencil className="mr-1 h-3 w-3" /> แก้ไข
                      <ChevronDown className={'ml-1 h-3 w-3 transition-transform ' + (editingId === c.id ? 'rotate-180' : '')} />
                    </Button>
                  </CollapsibleTrigger>
                  <Button size="sm" variant={c.isActive ? 'ghost' : 'outline'} className={`h-7 text-xs ${c.isActive ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-emerald-700'}`} aria-label={c.isActive ? `ปิดใช้งานโค้ช ${c.name}` : `เปิดใช้งานโค้ช ${c.name}`} onClick={() => toggleActive(c)}>
                    <Power className="mr-1 h-3 w-3" /> {c.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50" aria-label={`ลบโค้ช ${c.name} ถาวร`} onClick={() => remove(c)}>
                    <Trash2 className="mr-1 h-3 w-3" /> ลบ
                  </Button>
                </div>
              </div>

              {/* ฟอร์มแก้ไขกางออกใต้แถวนี้เท่านั้น */}
              <CollapsibleContent>
                <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
                  <CoachFormFields form={form} setForm={setForm} prefix={c.id} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={() => save(c.id)} disabled={saving || !form.name.trim()}>
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
