'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/lib/api'
import { toast } from 'sonner'
import {
  CalendarDays, CheckCircle2, Clock, GraduationCap, Loader2, MapPin, Phone, Receipt,
  RefreshCw, Search, User, XCircle, ZoomIn,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatThaiDate, statusMeta } from './slip-helpers'

/** แถวการจองโค้ชจาก /api/coach-bookings */
interface CoachBookingRow {
  id: string
  ticketCode?: string | null
  coachId: string
  coachName: string
  coachPrice: number
  courtName: string
  bookingDate: string
  startTimes: string
  hours: number
  courtTotal: number
  coachTotal: number
  totalPrice: number
  playerName: string
  playerPhone: string
  note?: string | null
  slipName?: string | null
  slipDataUrl?: string | null
  status: string
  createdAt?: string
}

/** "09:00" → "09:00-10:00" (ช่วงละ 1 ชั่วโมง) */
function hourRange(start: string): string {
  const h = Number(start.split(':')[0])
  return `${start}-${String((h + 1) % 24).padStart(2, '0')}:00`
}

/** "09:00,13:00" → "09:00-10:00, 13:00-14:00" */
function timeRangeLabel(startTimes: string): string {
  return String(startTimes ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map(hourRange)
    .join(', ')
}

function thb(amount: number): string {
  return `฿${Number(amount || 0).toLocaleString()}`
}

/**
 * แผง "โค้ช" ใน Dashboard — รายการจองโค้ชจริง (ค่าสนาม + ค่าโค้ช)
 * แอดมินตรวจสลิป → กดยืนยันการชำระ (สถานะ pending → confirmed) หรือยกเลิก (ปล่อยสนามคืน)
 */
export function CoachSection() {
  const [rows, setRows] = useState<CoachBookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<CoachBookingRow | null>(null)

  const fetchRows = useCallback(async (showToast = false) => {
    try {
      const res = await fetch(apiUrl('/api/coach-bookings'))
      const data = await res.json()
      setRows(Array.isArray(data) ? (data as CoachBookingRow[]) : [])
      if (showToast) toast.success('อัปเดตรายการจองโค้ชแล้ว')
    } catch {
      toast.error('โหลดรายการจองโค้ชไม่สำเร็จ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      confirmed: rows.filter((r) => r.status === 'confirmed').length,
      revenue: rows.filter((r) => r.status !== 'cancelled').reduce((sum, r) => sum + r.totalPrice, 0),
    }),
    [rows]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => {
        if (!q) return true
        return (
          r.playerName.toLowerCase().includes(q) ||
          r.playerPhone.toLowerCase().includes(q) ||
          r.coachName.toLowerCase().includes(q) ||
          r.courtName.toLowerCase().includes(q) ||
          String(r.ticketCode ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.bookingDate === b.bookingDate
        ? String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
        : b.bookingDate.localeCompare(a.bookingDate)))
  }, [rows, search, statusFilter])

  /** อัปเดตการจองโค้ช (ยืนยันการชำระ / ลบสลิป) ผ่าน /api/coach-bookings */
  const patchRow = async (row: CoachBookingRow, payload: Record<string, unknown>, successMsg: string) => {
    setBusyId(row.id)
    try {
      const res = await fetch(apiUrl('/api/coach-bookings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, ...payload }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'อัปเดตไม่สำเร็จ')
      toast.success(successMsg)
      fetchRows()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  /** ยกเลิกการจองโค้ช — สนามที่กันไว้จะถูกปล่อยคืน */
  const cancelRow = async (row: CoachBookingRow) => {
    if (!confirm(`ยกเลิกการจองโค้ช #${row.ticketCode ?? row.id}? สนามที่กันไว้จะถูกปล่อยคืน`)) return
    setBusyId(row.id)
    try {
      const res = await fetch(apiUrl(`/api/coach-bookings?id=${row.id}`), { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'ยกเลิกไม่สำเร็จ')
      toast.success('ยกเลิกการจองโค้ชแล้ว')
      fetchRows()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  const downloadSlip = (row: CoachBookingRow) => {
    if (!row.slipDataUrl) return
    const link = document.createElement('a')
    link.download = row.slipName || `slip-${row.ticketCode ?? row.id}.jpg`
    link.href = row.slipDataUrl
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-emerald-700">{stats.total}</div>
            <div className="text-[11px] text-muted-foreground">รายการทั้งหมด</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-[11px] text-muted-foreground">รอตรวจสอบการชำระ</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-emerald-600">{stats.confirmed}</div>
            <div className="text-[11px] text-muted-foreground">ยืนยันแล้ว</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold">{thb(stats.revenue)}</div>
            <div className="text-[11px] text-muted-foreground">ยอดรวม (ไม่รวมที่ยกเลิก)</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            การจองโค้ช
            <Badge variant="outline" className="ml-auto text-[11px]">{filtered.length} รายการ</Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => { setRefreshing(true); fetchRows(true) }}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              รีเฟรช
            </Button>
          </CardTitle>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา ชื่อ / เบอร์ / โค้ช / สนาม / รหัสตั๋ว"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  className={
                    'h-8 text-[11px] ' + (statusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700' : '')
                  }
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'ทั้งหมด' : statusMeta(s).label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <GraduationCap className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">ยังไม่มีการจองโค้ช</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">วัน / เวลา</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">โค้ช / สนาม</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ลูกค้า</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ยอดชำระ</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">สลิป</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">สถานะ</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const meta = statusMeta(r.status)
                    const busy = busyId === r.id
                    return (
                      <tr key={r.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatThaiDate(r.bookingDate)}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {timeRangeLabel(r.startTimes)} น.
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                            {r.coachName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {r.courtName} • {r.hours} ชม.
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {r.playerName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {r.playerPhone}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            #{r.ticketCode ?? '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm font-semibold text-emerald-700">{thb(r.totalPrice)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            สนาม {thb(r.courtTotal)} + โค้ช {thb(r.coachTotal)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {r.slipDataUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreview(r)}
                              title="ดูสลิป"
                              className="group relative block"
                            >
                              <img
                                src={r.slipDataUrl}
                                alt={`สลิป ${r.ticketCode ?? r.id}`}
                                className="h-12 w-12 rounded border object-cover"
                              />
                              <span className="absolute inset-0 hidden items-center justify-center rounded bg-black/40 group-hover:flex">
                                <ZoomIn className="h-4 w-4 text-white" />
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">— ไม่มี —</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[11px] ${meta.className}`}>
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                {r.slipDataUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-[11px]"
                                    onClick={() => setPreview(r)}
                                  >
                                    <ZoomIn className="h-3.5 w-3.5" /> ดูสลิป
                                  </Button>
                                )}
                                {r.status !== 'confirmed' && r.status !== 'cancelled' && (
                                  <Button
                                    size="sm"
                                    className="h-7 gap-1 bg-emerald-600 text-[11px] hover:bg-emerald-700"
                                    onClick={() => patchRow(r, { status: 'confirmed' }, `ยืนยันการชำระ #${r.ticketCode ?? ''} แล้ว`)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยัน
                                  </Button>
                                )}
                                {r.status !== 'cancelled' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 border-red-200 text-[11px] text-red-600 hover:bg-red-50"
                                    onClick={() => cancelRow(r)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> ยกเลิก
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* dialog ดูสลิปขนาดเต็ม */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              สลิปการชำระ #{preview?.ticketCode ?? ''}
            </DialogTitle>
            <DialogDescription>
              {preview
                ? `${preview.playerName} • ${formatThaiDate(preview.bookingDate)} • ${timeRangeLabel(preview.startTimes)} น. • ${preview.coachName} • ${preview.courtName} • รวม ${thb(preview.totalPrice)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {preview?.slipDataUrl && (
            <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 p-2">
              <img
                src={preview.slipDataUrl}
                alt={`สลิป ${preview.ticketCode ?? ''}`}
                className="mx-auto max-w-full rounded"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPreview(null)}>
              ปิด
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { if (preview) downloadSlip(preview) }}
            >
              ดาวน์โหลดสลิป
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
