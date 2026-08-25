'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Pencil, Trash2, Save, X, Dumbbell,
  MapPin, Wrench, Loader2, Check, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Court {
  id: string
  name: string
  description: string | null
  pricePerHour: number
  isActive: boolean
  sortOrder: number
}

interface Equipment {
  id: string
  name: string
  nameEn: string | null
  pricePerUnit: number
  isActive: boolean
  sortOrder: number
}

interface Settings {
  arena_name?: string
  arena_phone?: string
  arena_address?: string
  [key: string]: string | undefined
}

const COURT_COLORS = [
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
]
const COURT_ICONS = ['1', '2', '3', '4', '5', '6']

export default function SettingsPage() {
  const router = useRouter()
  const [courts, setCourts] = useState<Court[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit states
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [showNewCourt, setShowNewCourt] = useState(false)
  const [showNewEquipment, setShowNewEquipment] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [courtsRes, equipRes, settingsRes] = await Promise.all([
        fetch('/api/courts'),
        fetch('/api/equipment'),
        fetch('/api/settings'),
      ])
      const courtsData = await courtsRes.json()
      const equipData = await equipRes.json()
      const settingsData = await settingsRes.json()
      setCourts(courtsData)
      setEquipment(equipData)
      setSettings(settingsData)
    } catch (err) {
      console.error('Failed to fetch settings data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Court CRUD
  const handleSaveCourt = async (court: Partial<Court>) => {
    setSaving(true)
    try {
      if (court.id) {
        await fetch('/api/courts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(court) })
        toast.success('อัปเดตสนามสำเร็จ')
      } else {
        await fetch('/api/courts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(court) })
        toast.success('เพิ่มสนามสำเร็จ')
      }
      setEditingCourt(null)
      setShowNewCourt(false)
      fetchData()
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCourt = async (id: string) => {
    if (!confirm('ต้องการลบสนามนี้?')) return
    try {
      await fetch(`/api/courts?id=${id}`, { method: 'DELETE' })
      toast.success('ลบสนามสำเร็จ')
      fetchData()
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  // Equipment CRUD
  const handleSaveEquipment = async (item: Partial<Equipment>) => {
    setSaving(true)
    try {
      if (item.id) {
        await fetch('/api/equipment', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
        toast.success('อัปเดตอุปกรณ์สำเร็จ')
      } else {
        await fetch('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
        toast.success('เพิ่มอุปกรณ์สำเร็จ')
      }
      setEditingEquipment(null)
      setShowNewEquipment(false)
      fetchData()
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('ต้องการลบอุปกรณ์นี้?')) return
    try {
      await fetch(`/api/equipment?id=${id}`, { method: 'DELETE' })
      toast.success('ลบอุปกรณ์สำเร็จ')
      fetchData()
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  // Settings save
  const handleSaveSetting = async (key: string, value: string) => {
    try {
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
      setSettings(prev => ({ ...prev, [key]: value }))
      toast.success('บันทึกการตั้งค่าสำเร็จ')
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Wrench className="h-5 w-5 text-emerald-600" />
            <h1 className="font-bold text-base">ตั้งค่าระบบ</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-6">
        {/* Arena Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-emerald-600" />
              ข้อมูลสนาม
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ชื่อสนาม</Label>
              <Input
                value={settings.arena_name || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, arena_name: e.target.value }))}
                onBlur={(e) => handleSaveSetting('arena_name', e.target.value)}
                placeholder="P19 Pickleball Arena"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">เบอร์โทร</Label>
              <Input
                value={settings.arena_phone || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, arena_phone: e.target.value }))}
                onBlur={(e) => handleSaveSetting('arena_phone', e.target.value)}
                placeholder="02-xxx-xxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ที่อยู่</Label>
              <Input
                value={settings.arena_address || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, arena_address: e.target.value }))}
                onBlur={(e) => handleSaveSetting('arena_address', e.target.value)}
                placeholder="ที่อยู่สนาม"
              />
            </div>
          </CardContent>
        </Card>

        {/* Courts Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                จัดการสนาม
                <Badge variant="secondary" className="text-xs">{courts.length}</Badge>
              </CardTitle>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => setShowNewCourt(true)}>
                <Plus className="h-3 w-3 mr-1" /> เพิ่มสนาม
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {courts.length === 0 && !showNewCourt && (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีสนาม</p>
            )}

            {courts.map((court, idx) => (
              <div key={court.id}>
                {editingCourt?.id === court.id ? (
                  <CourtForm
                    initial={court}
                    onSave={handleSaveCourt}
                    onCancel={() => setEditingCourt(null)}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                    <div className={`${COURT_COLORS[idx % COURT_COLORS.length]} text-white rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0`}>
                      {COURT_ICONS[idx % COURT_ICONS.length]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{court.name}</div>
                      <div className="text-xs text-muted-foreground">{court.description || '-'}</div>
                      <div className="text-xs font-semibold text-emerald-700">฿{court.pricePerHour.toLocaleString()}/ชม.</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600"
                        onClick={() => setEditingCourt(court)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                        onClick={() => handleDeleteCourt(court.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showNewCourt && (
              <CourtForm
                initial={{ name: `สนาม ${courts.length + 1}`, pricePerHour: 300, sortOrder: courts.length + 1, isActive: true }}
                onSave={(data) => handleSaveCourt(data)}
                onCancel={() => setShowNewCourt(false)}
                saving={saving}
              />
            )}
          </CardContent>
        </Card>

        {/* Rental Equipment Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-emerald-600" />
                อุปกรณ์เช่า
                <Badge variant="secondary" className="text-xs">{equipment.length}</Badge>
              </CardTitle>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => setShowNewEquipment(true)}>
                <Plus className="h-3 w-3 mr-1" /> เพิ่มอุปกรณ์
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {equipment.length === 0 && !showNewEquipment && (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีอุปกรณ์เช่า</p>
            )}

            {equipment.map((item) => (
              <div key={item.id}>
                {editingEquipment?.id === item.id ? (
                  <EquipmentForm
                    initial={item}
                    onSave={handleSaveEquipment}
                    onCancel={() => setEditingEquipment(null)}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-lg">🏸</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.nameEn || ''}</div>
                      <div className="text-xs font-semibold text-amber-700">฿{item.pricePerUnit.toLocaleString()}/ชิ้น</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600"
                        onClick={() => setEditingEquipment(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                        onClick={() => handleDeleteEquipment(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showNewEquipment && (
              <EquipmentForm
                initial={{ name: '', pricePerUnit: 50, sortOrder: equipment.length + 1, isActive: true }}
                onSave={(data) => handleSaveEquipment(data)}
                onCancel={() => setShowNewEquipment(false)}
                saving={saving}
              />
            )}
          </CardContent>
        </Card>

        <div className="pb-8" />
      </main>
    </div>
  )
}

/* Court Form Component */
function CourtForm({ initial, onSave, onCancel, saving }: {
  initial: Partial<Court>
  onSave: (data: Partial<Court>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    pricePerHour: initial.pricePerHour || 300,
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
          <Label className="text-xs">ราคา/ชม.</Label>
          <Input
            type="number"
            value={form.pricePerHour}
            onChange={(e) => setForm(prev => ({ ...prev, pricePerHour: parseInt(e.target.value) || 0 }))}
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

/* Equipment Form Component */
function EquipmentForm({ initial, onSave, onCancel, saving }: {
  initial: Partial<Equipment>
  onSave: (data: Partial<Equipment>) => void
  onCancel: () => void
  saving: boolean
}) {
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
