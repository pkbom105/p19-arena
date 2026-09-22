'use client'

import { apiUrl, BASE_PATH } from '@/lib/api'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { BookingSection } from './booking-section'
import { CourtSection } from './court-section'
import { DashboardHeader } from './dashboard-header'
import { DashboardSidebar } from './dashboard-sidebar'
import { EquipmentSection } from './equipment-section'
import { LineSection } from './line-section'
import { OverviewSection } from './overview-section'
import { SectionTabs } from './section-tabs'
import { SlipUploadPanel } from './slip-upload-panel'
import { SECTIONS, type SectionId } from './helpers'
import type { PriceRule } from '@/lib/price'
import type {
  BookingRow, Court, Equipment, LineMember, MessagingStatus, Settings, Stats, TimeSlotItem,
} from './types'

/**
 * หน้าหลัก Dashboard — รวม state/การโหลดข้อมูลไว้ที่เดียว แล้วส่งต่อให้แต่ละ section
 * (header / sidebar / overview / court / equipment / booking / line) ซึ่งแยกไฟล์ไว้ในโฟลเดอร์นี้
 */
export function DashboardView({ initialSection }: { initialSection?: string }) {
  const pathname = usePathname()
  const [section, setSection] = useState<SectionId>(
    SECTIONS.some((s) => s.id === initialSection) ? (initialSection as SectionId) : 'overview'
  )

  /** สลับ section + sync URL (/dashboard/<section>) โดยไม่ re-mount/refetch */
  const goSection = (id: SectionId) => {
    setSection(id)
    window.history.pushState(null, '', `${BASE_PATH}/dashboard/${id}`)
  }
  const [courts, setCourts] = useState<Court[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlotItem[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  // Edit states
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [showNewCourt, setShowNewCourt] = useState(false)
  const [showNewEquipment, setShowNewEquipment] = useState(false)
  const [editingPriceRule, setEditingPriceRule] = useState<PriceRule | null>(null)
  const [showNewPriceRule, setShowNewPriceRule] = useState(false)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [editingBooking, setEditingBooking] = useState<BookingRow | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lineMembers, setLineMembers] = useState<LineMember[]>([])
  const [msgStatus, setMsgStatus] = useState<MessagingStatus | null>(null)
  const [msgChannelId, setMsgChannelId] = useState('')
  const [msgChannelSecret, setMsgChannelSecret] = useState('')
  const [isSavingMsg, setIsSavingMsg] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [courtsRes, equipRes, settingsRes, rulesRes, slotsRes, bookingsRes, statsRes, usersRes, msgRes] = await Promise.all([
        fetch(apiUrl('/api/courts')),
        fetch(apiUrl('/api/equipment')),
        fetch(apiUrl('/api/settings')),
        fetch(apiUrl('/api/pricerules')),
        fetch(apiUrl('/api/timeslots?all=1')),
        fetch(apiUrl('/api/bookings')),
        fetch(apiUrl('/api/stats')),
        fetch(apiUrl('/api/users')),
        fetch(apiUrl('/api/line-messaging')),
      ])
      const courtsData = await courtsRes.json()
      const equipData = await equipRes.json()
      const settingsData = await settingsRes.json()
      const rulesData = await rulesRes.json()
      const slotsData = await slotsRes.json()
      const bookingsData = await bookingsRes.json()
      const statsData = await statsRes.json()
      const usersData = await usersRes.json()
      setCourts(courtsData)
      setEquipment(equipData)
      setSettings(settingsData)
      if (Array.isArray(rulesData)) setPriceRules(rulesData)
      if (Array.isArray(slotsData)) setTimeSlots(slotsData)
      if (Array.isArray(bookingsData)) setBookings(bookingsData)
      if (statsData && !statsData.error) setStats(statsData)
      if (Array.isArray(usersData)) setLineMembers(usersData)
      const msgData = await msgRes.json().catch(() => null)
      if (msgData && !msgData.error) {
        setMsgStatus(msgData)
        if (msgData.connected) setMsgChannelId(msgData.channelId || '')
      }
    } catch (err) {
      console.error('Failed to fetch settings data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Back/Forward: sync section กับ URL (เช่น /dashboard/court → tab "Court")
  useEffect(() => {
    const seg = (pathname ?? '').split('/').filter(Boolean)
    const maybe = seg.length > 1 ? seg[1] : 'overview'
    if (SECTIONS.some((s) => s.id === maybe) && maybe !== section) {
      setSection(maybe as SectionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Court CRUD
  const handleSaveCourt = async (court: Partial<Court>) => {
    setSaving(true)
    try {
      if (court.id) {
        await fetch(apiUrl('/api/courts'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(court) })
        toast.success('อัปเดตสนามสำเร็จ')
      } else {
        await fetch(apiUrl('/api/courts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(court) })
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
      await fetch(apiUrl(`/api/courts?id=${id}`), { method: 'DELETE' })
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
        await fetch(apiUrl('/api/equipment'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
        toast.success('อัปเดตอุปกรณ์สำเร็จ')
      } else {
        await fetch(apiUrl('/api/equipment'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
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
      await fetch(apiUrl(`/api/equipment?id=${id}`), { method: 'DELETE' })
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
        await fetch(apiUrl('/api/pricerules'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) })
        toast.success('อัปเดตราคาสำเร็จ')
      } else {
        await fetch(apiUrl('/api/pricerules'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) })
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
      await fetch(apiUrl(`/api/pricerules?id=${id}`), { method: 'DELETE' })
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
      const res = await fetch(apiUrl('/api/bookings'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
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
      await fetch(apiUrl(`/api/bookings?id=${id}`), { method: 'DELETE' })
      toast.success('ยกเลิกการจองสำเร็จ')
      fetchData()
    } catch {
      toast.error('ยกเลิกไม่สำเร็จ')
    }
  }

  const handleCopyTicketLink = async (booking: BookingRow) => {
    const code = booking.ticketCode || booking.id
    const url = `${window.location.origin}${BASE_PATH}/ticket/${code}`
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
      await fetch(apiUrl('/api/settings'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
      setSettings(prev => ({ ...prev, [key]: value }))
      toast.success('บันทึกการตั้งค่าสำเร็จ')
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    }
  }

// LINE Login — connection status + save both fields
  const lineConnected = !!(
    (settings.line_channel_id && settings.line_channel_id.trim()) &&
    (settings.line_channel_secret && settings.line_channel_secret.trim())
  )

  const handleSaveLine = async () => {
    try {
      await Promise.all([
        fetch(apiUrl('/api/settings'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'line_channel_id', value: (settings.line_channel_id || '').trim() }) }),
        fetch(apiUrl('/api/settings'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'line_channel_secret', value: settings.line_channel_secret || '' }) }),
      ])
      toast.success('LINE settings saved')
      fetchData()
    } catch {
      toast.error('LINE save failed')
    }
  }

  // LINE Messaging API — บันทึก + ทดสอบจริงกับ LINE (issue access token ทันที)
  const handleSaveMessaging = async () => {
    try {
      setIsSavingMsg(true)
      const res = await fetch(apiUrl('/api/line-messaging'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: msgChannelId.trim(),
          channelSecret: msgChannelSecret.trim() || '********',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'บันทึกไม่สำเร็จ')
      toast.success('เชื่อมต่อ Messaging API สำเร็จ — ตั๋วจะถูกส่งเข้าแชทลูกค้าหลังจอง')
      setMsgChannelSecret('')
      fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'เชื่อมต่อไม่สำเร็จ — เช็ค Channel ID/Secret')
    } finally {
      setIsSavingMsg(false)
    }
  }

  // ปุ่ม "แชท LINE" — เปิดหน้าจอแชทของ LINE OA (ไม่ต้องเขียนโค้ด/ไม่ต้อง webhook)
  // basicId เก็บใน settings (ค่าเริ่มต้น = OA จริงของสาขา) → แก้ได้จากหน้าเว็บ ไม่ต้องแก้โค้ด
  const oaBasicId = (settings.line_oa_basic_id || '').trim() || '@323xcbvy'
  const oaId = oaBasicId.replace(/^@/, '')
  // ผู้ดูแล (เดสก์ท็อป) → เปิดหน้าจอแชทใน LINE Official Account Manager (ลิงก์ scheme ของ LINE ไม่รองรับบน LINE for PC)
  const oaManagerChatUrl = `https://manager.line.biz/account/@${oaId}/chat`
  // ลูกค้า (มือถือ) → ลิงก์เปิดแชทกับ OA ; '@' ต้อง encode เป็น %40
  const oaCustomerChatUrl = `https://line.me/R/oaMessage/%40${oaId}/`

  const handleSaveOaBasicId = async () => {
    const raw = (settings.line_oa_basic_id || '').trim()
    const normalized = raw ? (raw.startsWith('@') ? raw : `@${raw}`) : ''
    try {
      await fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'line_oa_basic_id', value: normalized }),
      })
      setSettings(prev => ({ ...prev, line_oa_basic_id: normalized }))
      toast.success('บันทึก LINE OA ID สำเร็จ')
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    }
  }

  const handleCopyCustomerChatLink = async () => {
    try {
      await navigator.clipboard.writeText(oaCustomerChatUrl)
      toast.success('คัดลอกลิงก์แชท LINE แล้ว — ส่งให้ลูกค้าได้เลย')
    } catch {
      toast.error(`คัดลอกไม่สำเร็จ — ลิงก์คือ ${oaCustomerChatUrl}`)
    }
  }

  // รีเฟรชรายการจองเฉพาะส่วน (ไม่โหลดทั้งหน้าใหม่)
  const refreshBookings = async () => {
    try {
      setRefreshing(true)
      const res = await fetch(apiUrl('/api/bookings'))
      const data = await res.json()
      if (Array.isArray(data)) setBookings(data)
      toast.success('อัปเดตรายการจองแล้ว')
    } catch {
      toast.error('รีเฟรชไม่สำเร็จ')
    } finally {
      setRefreshing(false)
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
      <DashboardHeader oaManagerChatUrl={oaManagerChatUrl} />

      <div className="flex flex-1">
        <DashboardSidebar section={section} onSelect={goSection} />

        <main className="flex-1 min-w-0 px-4 py-5 lg:pl-4">
          <Tabs value={section} onValueChange={(v) => goSection(v as SectionId)} className="w-full">
            <SectionTabs />

            <TabsContent value="overview" className="space-y-6">
              <OverviewSection stats={stats} />
            </TabsContent>

            <TabsContent value="court" className="space-y-6">
              <CourtSection
                settings={settings}
                setSettings={setSettings}
                handleSaveSetting={handleSaveSetting}
                courts={courts}
                editingCourt={editingCourt}
                setEditingCourt={setEditingCourt}
                handleSaveCourt={handleSaveCourt}
                handleDeleteCourt={handleDeleteCourt}
                showNewCourt={showNewCourt}
                setShowNewCourt={setShowNewCourt}
                priceRules={priceRules}
                editingPriceRule={editingPriceRule}
                setEditingPriceRule={setEditingPriceRule}
                handleSavePriceRule={handleSavePriceRule}
                handleDeletePriceRule={handleDeletePriceRule}
                showNewPriceRule={showNewPriceRule}
                setShowNewPriceRule={setShowNewPriceRule}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="booking" className="space-y-6">
              <BookingSection
                bookings={bookings}
                courts={courts}
                timeSlots={timeSlots}
                editingBooking={editingBooking}
                setEditingBooking={setEditingBooking}
                handleUpdateBooking={handleUpdateBooking}
                handleCancelBooking={handleCancelBooking}
                handleCopyTicketLink={handleCopyTicketLink}
                refreshing={refreshing}
                refreshBookings={refreshBookings}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="slip" className="space-y-6">
              <SlipUploadPanel bookings={bookings} loading={loading} onRefresh={fetchData} />
            </TabsContent>

            <TabsContent value="line" className="space-y-6">
              <LineSection
                settings={settings}
                setSettings={setSettings}
                lineConnected={lineConnected}
                handleSaveLine={handleSaveLine}
                msgStatus={msgStatus}
                msgChannelId={msgChannelId}
                setMsgChannelId={setMsgChannelId}
                msgChannelSecret={msgChannelSecret}
                setMsgChannelSecret={setMsgChannelSecret}
                isSavingMsg={isSavingMsg}
                handleSaveMessaging={handleSaveMessaging}
                oaBasicId={oaBasicId}
                oaManagerChatUrl={oaManagerChatUrl}
                oaCustomerChatUrl={oaCustomerChatUrl}
                handleCopyCustomerChatLink={handleCopyCustomerChatLink}
                handleSaveOaBasicId={handleSaveOaBasicId}
                lineMembers={lineMembers}
              />
            </TabsContent>

            <TabsContent value="equipment" className="space-y-6">
              <EquipmentSection
                equipment={equipment}
                editingEquipment={editingEquipment}
                setEditingEquipment={setEditingEquipment}
                handleSaveEquipment={handleSaveEquipment}
                handleDeleteEquipment={handleDeleteEquipment}
                showNewEquipment={showNewEquipment}
                setShowNewEquipment={setShowNewEquipment}
                saving={saving}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <div className="pb-8" />
    </div>
  )
}
