'use client'

import { useMemo, useState } from 'react'
import { apiUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getTicketCode } from '@/components/booking/booking-ticket'
import { toast } from 'sonner'
import { Loader2, Receipt, RefreshCw, Search } from 'lucide-react'
import { SlipAttachDialog } from './slip-attach-dialog'
import { SlipPreviewDialog } from './slip-preview-dialog'
import { SlipStats } from './slip-stats'
import { SlipTable } from './slip-table'
import { type SlipBooking, type Scope, type StatusFilter } from './slip-helpers'

export type { SlipBooking } from './slip-helpers'

interface SlipUploadPanelProps {
  bookings: SlipBooking[]
  loading?: boolean
  onRefresh: () => void
}

/**
 * แผง "Slip Upload" ใน Dashboard — ให้แอดมินตรวจ/แนบสลิปการชำระเงิน
 * ลูกค้าส่งสลิปจากหน้า /check → สถานะเป็น "รอชำระ" → แอดมินกดยืนยันชำระที่นี่
 * หรือแนบสลิปแทนลูกค้าได้ (เคาน์เตอร์รับเงินสด)
 */
export function SlipUploadPanel({ bookings, loading = false, onRefresh }: SlipUploadPanelProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [scope, setScope] = useState<Scope>('slips')
  const [preview, setPreview] = useState<SlipBooking | null>(null)
  const [uploadFor, setUploadFor] = useState<SlipBooking | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  /** รายการที่มีสลิปแนบแล้ว */
  const withSlip = useMemo(() => bookings.filter((b) => !!b.slipDataUrl), [bookings])

  const stats = useMemo(() => ({
    slips: withSlip.length,
    pendingReview: withSlip.filter((b) => b.status === 'pending').length,
    confirmed: withSlip.filter((b) => b.status === 'confirmed').length,
    missing: bookings.filter((b) => !b.slipDataUrl && b.status !== 'cancelled').length,
  }), [withSlip, bookings])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings
      .filter((b) => (scope === 'slips' ? !!b.slipDataUrl : true))
      .filter((b) => (statusFilter === 'all' ? true : b.status === statusFilter))
      .filter((b) => {
        if (!q) return true
        return (
          b.playerName.toLowerCase().includes(q) ||
          b.playerPhone.toLowerCase().includes(q) ||
          getTicketCode(b).toLowerCase().includes(q) ||
          b.court.name.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.bookingDate === b.bookingDate
        ? a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
        : b.bookingDate.localeCompare(a.bookingDate)))
  }, [bookings, search, statusFilter, scope])

  /** อัปเดตการจอง (ยืนยันชำระ / ลบสลิป) ผ่าน API เดิม แล้วโหลดข้อมูลใหม่ */
  const patchBooking = async (b: SlipBooking, payload: Record<string, unknown>, successMsg: string) => {
    setBusyId(b.id)
    try {
      const res = await fetch(apiUrl('/api/bookings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, ...payload }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'อัปเดตไม่สำเร็จ')
      toast.success(successMsg)
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  const handleDownload = (b: SlipBooking) => {
    if (!b.slipDataUrl) return
    const link = document.createElement('a')
    link.download = b.slipName || `slip-${getTicketCode(b)}.jpg`
    link.href = b.slipDataUrl
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* สรุปจำนวนสลิป */}
      <SlipStats
        slips={stats.slips}
        pendingReview={stats.pendingReview}
        confirmed={stats.confirmed}
        missing={stats.missing}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              สลิปการชำระเงิน — ตรวจสอบ / แนบ / ยืนยัน
            </span>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={onRefresh} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              รีเฟรช
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ตัวกรอง */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา ชื่อ / เบอร์ / รหัสตั๋ว / สนาม"
                className="h-9 pl-7 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="pending">รอชำระ</option>
              <option value="confirmed">ยืนยันแล้ว</option>
            </select>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="slips">เฉพาะที่มีสลิป</option>
              <option value="all">การจองทั้งหมด</option>
            </select>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              {scope === 'slips'
                ? 'ยังไม่มีสลิปที่ลูกค้าส่งเข้ามา — เปลี่ยนเป็น "การจองทั้งหมด" เพื่อแนบสลิปแทนลูกค้า'
                : 'ไม่พบรายการจอง — ลองเปลี่ยนตัวกรองหรือค้นหาคำอื่น'}
            </p>
          ) : (
            <SlipTable
              rows={rows}
              busyId={busyId}
              onPreview={setPreview}
              onUpload={setUploadFor}
              onPatch={patchBooking}
            />
          )}

          <p className="text-[11px] text-muted-foreground">
            สลิปที่ลูกค้าส่งจากหน้า /check จะเข้ามาที่นี่ — กด &quot;ยืนยัน&quot; เพื่อเปลี่ยนสถานะเป็นยืนยันแล้ว
            (รองรับ jpg / png ไม่เกิน 300kB ต่อไฟล์)
          </p>
        </CardContent>
      </Card>

      <SlipPreviewDialog booking={preview} onClose={() => setPreview(null)} onDownload={handleDownload} />

      <SlipAttachDialog booking={uploadFor} onClose={() => setUploadFor(null)} onUploaded={onRefresh} />
    </div>
  )
}
