'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Pencil, Trash2, Save, X, Dumbbell,
  MapPin, Wrench, Loader2, Check, Tag, Clock, CalendarDays,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BookingTicket } from '@/components/booking/booking-ticket'
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

interface PriceRule {
  id: string
  name: string | null
  days: string | null // "0,1,2,3,4,5,6" (0=อาทิตย์..6=เสาร์) ; null/"" = ทุกวัน
  startTime: string
  endTime: string
  price: number
  sortOrder: number
}

interface TimeSlotItem {
  id: string
  startTime: string
  endTime: string
  dayOfWeek: number
  isActive: boolean
  sortOrder: number
}

interface BookingRow {
  id: string
  ticketCode?: string | null
  courtId: string
  timeSlotId: string
  bookingDate: string
  status: string
  playerName: string
  playerPhone: string
  playerEmail: string | null
  note: string | null
  racketCount: number
  court: { id: string; name: string }
  timeSlot: { id: string; startTime: string; endTime: string }
}

const DAY_OPTIONS = [
  { value: '0', label: 'อาทิตย์' },
  { value: '1', label: 'จันทร์' },
  { value: '2', label: 'อังคาร' },
  { value: '3', label: 'พุธ' },
  { value: '4', label: 'พฤหัสบดี' },
  { value: '5', label: 'ศุกร์' },
  { value: '6', label: 'เสาร์' },
]

/** แสดงชื่อวัน จาก string "0,1,6" -> "อาทิตย์, จันทร์, เสาร์" ; ว่าง -> "ทุกวัน" */
function formatDays(days: string | null): string {
  if (!days || days.trim() === '') return 'ทุกวัน'
  return days
    .split(',')
    .map((d) => DAY_OPTIONS[Number(d)]?.label)
    .filter(Boolean)
    .join(', ')
}

const COURT_COLORS = [
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
]
const COURT_ICONS = ['1', '2', '3', '4', '5', '6']

export default function SettingsPage() {
  const router = useRouter()
  const [courts, setCourts] = useState<Court[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlotItem[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit states
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [showNewCourt, setShowNewCourt] = useState(false)
  const [showNewEquipment, setShowNewEquipment] = useState(false)
  const [editingPriceRule, setEditingPriceRule] = useState<PriceRule | null>(null)
  const [showNewPriceRule, setShowNewPriceRule] = useState(false)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [editingBooking, setEditingBooking] = useState<BookingRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [courtsRes, equipRes, settingsRes, rulesRes, slotsRes, bookingsRes] = await Promise.all([
        fetch('/api/courts'),
        fetch('/api/equipment'),
        fetch('/api/settings'),
        fetch('/api/pricerules'),
        fetch('/api/timeslots?all=1'),
        fetch('/api/bookings'),
      ])
      const courtsData = await courtsRes.json()
      const equipData = await equipRes.json()
      const settingsData = await settingsRes.json()
      const rulesData = await rulesRes.json()
      const slotsData = await slotsRes.json()
      const bookingsData = await bookingsRes.json()
      setCourts(courtsData)
      setEquipment(equipData)
      setSettings(settingsData)
      if (Array.isArray(rulesData)) setPriceRules(rulesData)
      if (Array.isArray(slotsData)) setTimeSlots(slotsData)
      if (Array.isArray(bookingsData)) setBookings(bookingsData)
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

  // Price Rule CRUD
  const handleSavePriceRule = async (rule: Partial<PriceRule>) => {
    setSaving(true)
    try {
      if (rule.id) {
        await fetch('/api/pricerules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) })
        toast.success('อัปเดตราคาสำเร็จ')
      } else {
        await fetch('/api/pricerules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) })
        toast.success('เพิ่มราคาสำเร็จ')
      }
      setEditingPriceRule(null)
      setShowNewPriceRule(false)
      fetchData()
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePriceRule = async (id: string) => {
    if (!confirm('ต้องการลบช่วงราคานี้?')) return
    try {
      await fetch(`/api/pricerules?id=${id}`, { method: 'DELETE' })
      toast.success('ลบช่วงราคาสำเร็จ')
      fetchData()
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  // Booking management
  const handleUpdateBooking = async (data: Partial<BookingRow>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/bookings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'อัปเดตการจองไม่สำเร็จ')
        return
      }
      toast.success('อัปเดตการจองสำเร็จ')
      setEditingBooking(null)
      fetchData()
    } catch {
      toast.error('อัปเดตไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelBooking = async (id: string) => {
    if (!confirm('ต้องการยกเลิกการจองนี้?')) return
    try {
      await fetch(`/api/bookings?id=${id}`, { method: 'DELETE' })
      toast.success('ยกเลิกการจองสำเร็จ')
      fetchData()
    } catch {
      toast.error('ยกเลิกไม่สำเร็จ')
    }
  }

  const handleCopyTicketLink = async (booking: BookingRow) => {
    const code = booking.ticketCode || booking.id
    const url = `${window.location.origin}/ticket/${code}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('คัดลอกลิงก์ตั๋วแล้ว')
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
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

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        <Tabs defaultValue="court" className="w-full">
          <TabsList className="w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="court" className="flex items-center justify-center gap-1.5">
              <MapPin className="h-4 w-4" /> สนาม
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center justify-center gap-1.5">
              <Wrench className="h-4 w-4" /> อุปกรณ์
            </TabsTrigger>
            <TabsTrigger value="booking" className="flex items-center justify-center gap-1.5">
              <Clock className="h-4 w-4" /> การจอง
            </TabsTrigger>
          </TabsList>

          <TabsContent value="court" className="space-y-6">
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
                initial={{ name: `สนาม ${courts.length + 1}`, sortOrder: courts.length + 1, isActive: true }}
                onSave={(data) => handleSaveCourt(data)}
                onCancel={() => setShowNewCourt(false)}
                saving={saving}
              />
            )}
          </CardContent>
        </Card>

        {/* Price Rules Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-violet-600" />
                ราคาตามช่วงเวลาและวัน
                <Badge variant="secondary" className="text-xs">{priceRules.length}</Badge>
              </CardTitle>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 h-7 text-xs" onClick={() => setShowNewPriceRule(true)}>
                <Plus className="h-3 w-3 mr-1" /> เพิ่มช่วงราคา
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              กำหนดราคาต่อชั่วโมงที่ต่างกันตามช่วงเวลาและวันในสัปดาห์ (ถ้าไม่มีช่วงที่ตรง ระบบจะใช้ราคาปกติของสนาม)
            </p>

            {priceRules.length === 0 && !showNewPriceRule && (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีช่วงราคา — ใช้ราคาปกติของสนามทุกช่วงเวลา</p>
            )}

            {priceRules.map((rule) => (
              <div key={rule.id}>
                {editingPriceRule?.id === rule.id ? (
                  <PriceRuleForm
                    initial={rule}
                    onSave={handleSavePriceRule}
                    onCancel={() => setEditingPriceRule(null)}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-violet-50/40 rounded-lg border border-violet-200">
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                      <Tag className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {rule.name || formatDays(rule.days)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rule.startTime} - {rule.endTime}
                        <span className="mx-1">•</span>
                        {formatDays(rule.days)}
                      </div>
                      <div className="text-xs font-semibold text-violet-700">฿{rule.price.toLocaleString()}/ชม.</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1.5 hover:bg-violet-100 rounded-lg text-violet-600"
                        onClick={() => setEditingPriceRule(rule)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                        onClick={() => handleDeletePriceRule(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showNewPriceRule && (
              <PriceRuleForm
                initial={{ name: '', days: '', startTime: '08:00', endTime: '18:00', price: 300, sortOrder: priceRules.length + 1 }}
                onSave={(data) => handleSavePriceRule(data)}
                onCancel={() => setShowNewPriceRule(false)}
                saving={saving}
              />
            )}
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="booking" className="space-y-6">
        {/* Customer Bookings Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
                การจองของลูกค้า
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              รายการจองที่ลูกค้าได้จองไว้ และบันทึกแล้ว — แก้ไขวัน/เวลา/สนาม/ข้อมูล หรือยกเลิกได้
            </p>

            {bookings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีการจอง</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {bookings.map((b) => (
              <div key={b.id} className={editingBooking?.id === b.id ? 'md:col-span-2' : ''}>
                {editingBooking?.id === b.id ? (
                  <BookingForm
                    initial={b}
                    courts={courts}
                    timeSlots={timeSlots}
                    onSave={handleUpdateBooking}
                    onCancel={() => setEditingBooking(null)}
                    saving={saving}
                  />
                ) : (
                  <BookingTicket
                    booking={b}
                    onEdit={() => setEditingBooking(b)}
                    onCancel={() => handleCancelBooking(b.id)}
                    onCopyLink={() => handleCopyTicketLink(b)}
                  />
                )}
              </div>
            ))}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-6">
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
          </TabsContent>
        </Tabs>

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
/* Price Rule Form Component */
function PriceRuleForm({ initial, onSave, onCancel, saving }: {
  initial: Partial<PriceRule>
  onSave: (data: Partial<PriceRule>) => void
  onCancel: () => void
  saving: boolean
}) {
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
/* Booking Form Component */
function BookingForm({ initial, courts, timeSlots, onSave, onCancel, saving }: {
  initial: BookingRow
  courts: Court[]
  timeSlots: TimeSlotItem[]
  onSave: (data: Partial<BookingRow>) => void
  onCancel: () => void
  saving: boolean
}) {
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
