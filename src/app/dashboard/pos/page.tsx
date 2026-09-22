'use client'

import { useCallback, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { CalendarDays, Loader2, Users } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiUrl } from '@/lib/api'
import type { PriceRule } from '@/lib/price'
import { toast } from 'sonner'
import { bookingPrice, isActiveStatus } from '@/components/pos/helpers'
import type { BookingRow, Court, NewBookingPreset, TimeSlotItem } from '@/components/pos/types'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { PosStats } from '@/components/pos/pos-stats'
import { BookingBoard } from '@/components/pos/booking-board'
import { BookingsTable } from '@/components/pos/bookings-table'
import { NewBookingDialog } from '@/components/pos/new-booking-dialog'
import { EditBookingDialog } from '@/components/pos/edit-booking-dialog'

/**
 * POS หน้าเคาน์เตอร์ (/dashboard/pos) — container
 * state + data fetching อยู่ที่นี่, UI แยกเป็น components/pos/*
 */
export default function PosPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const maxDateStr = format(addDays(new Date(), 42), 'yyyy-MM-dd')

  const [date, setDate] = useState(todayStr)
  const [view, setView] = useState<'board' | 'all'>('board')
  const [courts, setCourts] = useState<Court[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlotItem[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dialog: จองใหม่ (preset จากปุ่ม "จอง" ในตาราง หรือปุ่ม "จองใหม่")
  const [newPreset, setNewPreset] = useState<NewBookingPreset | null>(null)
  // Dialog: แก้ไขการจอง
  const [editingBooking, setEditingBooking] = useState<BookingRow | null>(null)

  // Filters (มุมมอง "รายการจองทั้งหมด")
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [dateScope, setDateScope] = useState<'all' | 'date'>('all')

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [courtsRes, slotsRes, bookingsRes, rulesRes] = await Promise.all([
        fetch(apiUrl('/api/courts')),
        fetch(apiUrl('/api/timeslots?all=1')),
        fetch(apiUrl('/api/bookings')),
        fetch(apiUrl('/api/pricerules')),
      ])
      const [courtsData, slotsData, bookingsData, rulesData] = await Promise.all([
        courtsRes.json(),
        slotsRes.json(),
        bookingsRes.json(),
        rulesRes.json(),
      ])
      if (Array.isArray(courtsData)) setCourts(courtsData)
      if (Array.isArray(slotsData)) setTimeSlots(slotsData)
      if (Array.isArray(bookingsData)) setBookings(bookingsData)
      if (Array.isArray(rulesData)) setPriceRules(rulesData)
    } catch (err) {
      console.error('Failed to fetch POS data', err)
    } finally {
      if (opts?.silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /** รีเฟรชเฉพาะรายการจอง (หลังจอง/แก้ไข/ยกเลิกจาก dialog) */
  const refreshBookings = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/bookings'))
      const data = await res.json()
      if (Array.isArray(data)) setBookings(data)
    } catch {
      toast.error('รีเฟรชรายการจองไม่สำเร็จ')
    }
  }, [])

  const handleCancelBooking = async (id: string) => {
    if (!confirm('ต้องการยกเลิกการจองนี้?')) return
    try {
      await fetch(apiUrl(`/api/bookings?id=${id}`), { method: 'DELETE' })
      toast.success('ยกเลิกการจองสำเร็จ')
      refreshBookings()
    } catch {
      toast.error('ยกเลิกไม่สำเร็จ')
    }
  }

  /* ---------- Derived (วันที่เลือก) ---------- */
  const dayOfWeek = date ? new Date(date + 'T00:00:00').getDay() : 0
  const daySlots = timeSlots
    .filter((t) => t.isActive && t.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const activeBookings = bookings.filter((b) => isActiveStatus(b.status))
  const dayBookings = bookings.filter((b) => b.bookingDate === date)
  const activeDayBookings = dayBookings.filter((b) => isActiveStatus(b.status))
  const pendingCount = dayBookings.filter((b) => b.status === 'pending').length
  const confirmedCount = dayBookings.filter((b) => b.status === 'confirmed').length
  const revenue = activeDayBookings.reduce((sum, b) => sum + bookingPrice(b, courts, priceRules), 0)

  // ช่องที่ถูกจอง (active) ของวันที่เลือก: key = courtId|timeSlotId
  const occupied = new Map<string, BookingRow>()
  for (const b of activeDayBookings) occupied.set(`${b.courtId}|${b.timeSlotId}`, b)

  // รายการจองทั้งหมด (filter + sort วันที่ล่าสุด → อนาคต)
  const filteredBookings = (() => {
    let list = [...bookings]
    if (dateScope === 'date') list = list.filter((b) => b.bookingDate === date)
    if (statusFilter !== 'all') list = list.filter((b) => b.status === statusFilter)
    if (courtFilter !== 'all') list = list.filter((b) => b.courtId === courtFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((b) =>
        (b.playerName || '').toLowerCase().includes(q) ||
        (b.playerPhone || '').includes(q) ||
        (b.ticketCode || '').toLowerCase().includes(q) ||
        (b.court?.name || '').toLowerCase().includes(q)
      )
    }
    return list.sort(
      (a, b) =>
        (b.bookingDate || '').localeCompare(a.bookingDate || '') ||
        (b.timeSlot?.startTime || '').localeCompare(a.timeSlot?.startTime || '')
    )
  })()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <PosHeader date={date} refreshing={refreshing} onRefresh={() => fetchData({ silent: true })} />
      <PosMobileNav />

      <div className="flex flex-1">
        <PosSidebar />

        <main className="min-w-0 flex-1 space-y-4 px-4 py-5 lg:pl-4">
          <PosStats
            date={date}
            activeCount={activeDayBookings.length}
            pendingCount={pendingCount}
            confirmedCount={confirmedCount}
            revenue={revenue}
          />

          <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'all')} className="w-full">
            <TabsList>
              <TabsTrigger value="board" className="gap-1.5">
                <CalendarDays className="h-4 w-4" /> ตารางจอง
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5">
                <Users className="h-4 w-4" /> รายการจองทั้งหมด
              </TabsTrigger>
            </TabsList>

            {/* ตารางจอง — สถานะของวันเดียว (เริ่มที่วันนี้ + date picker) */}
            <TabsContent value="board" className="mt-4">
              <BookingBoard
                date={date}
                onDateChange={setDate}
                todayStr={todayStr}
                courts={courts}
                daySlots={daySlots}
                occupied={occupied}
                priceRules={priceRules}
                dayOfWeek={dayOfWeek}
                onBookSlot={(p) => setNewPreset(p)}
                onNewBooking={() => setNewPreset({ bookingDate: date })}
                onEditBooking={setEditingBooking}
              />
            </TabsContent>

            {/* รายการจองทั้งหมด */}
            <TabsContent value="all" className="mt-4">
              <BookingsTable
                bookings={filteredBookings}
                courts={courts}
                priceRules={priceRules}
                date={date}
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                courtFilter={courtFilter}
                onCourtFilterChange={setCourtFilter}
                dateScope={dateScope}
                onDateScopeToggle={() => setDateScope(dateScope === 'date' ? 'all' : 'date')}
                onEditBooking={setEditingBooking}
                onCancelBooking={handleCancelBooking}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Dialogs */}
      {newPreset && (
        <NewBookingDialog
          preset={newPreset}
          courts={courts}
          timeSlots={timeSlots}
          activeBookings={activeBookings}
          priceRules={priceRules}
          todayStr={todayStr}
          maxDateStr={maxDateStr}
          onClose={() => setNewPreset(null)}
          onSaved={refreshBookings}
        />
      )}
      {editingBooking && (
        <EditBookingDialog
          booking={editingBooking}
          courts={courts}
          timeSlots={timeSlots}
          activeBookings={activeBookings}
          priceRules={priceRules}
          todayStr={todayStr}
          onClose={() => setEditingBooking(null)}
          onSaved={refreshBookings}
        />
      )}

      <div className="pb-8" />
    </div>
  )
}
