'use client'

import { useMemo, useState } from 'react'
import { Ban, CheckCircle2, Eye, Link2, Printer, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TABLE_PAGE_SIZE, TablePagination, paginate } from './table-pagination'

/** คำขอเติมเงิน 1 รายการ (ฟิลด์เท่าที่ตารางนี้ใช้) */
export interface RecentTopUpRow {
  id: string
  amount: number
  status: string
  createdAt: string
  slipName: string
  slipDataUrl: string
  /** true = สลิปซ้ำ (มี record อื่นใช้สลิปเดียวกัน) → ห้ามอนุมัติ */
  duplicate?: boolean
  user: {
    lineDisplayName: string | null
    name: string | null
    phone: string | null
  }
}

interface RecentTopupsTableProps {
  /** คำขอเติมเงินล่าสุดทั้งหมด (ตารางแบ่งหน้าเอง หน้าละ 5 แถว) */
  requests: RecentTopUpRow[]
  loading: boolean
  error?: string | null
  /** (ชั่วคราว) กดอนุมัติจากตาราง — ส่งแถวที่ต้องการอนุมัติกลับไปให้หน้าหลักจัดการ */
  onApprove?: (row: RecentTopUpRow) => void
  /** id ที่กำลังอนุมัติอยู่ (ปิดปุ่มชั่วคราว) */
  approvingId?: string | null
}

const formatBaht = (value: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)

const STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  pending: { label: 'รอตรวจสอบ', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'อนุมัติแล้ว', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'ปฏิเสธ', badgeClass: 'bg-muted text-muted-foreground border-border' },
}

const statusMeta = (status: string) =>
  STATUS_META[status] ?? { label: status, badgeClass: 'bg-muted text-muted-foreground' }

/** สลิปเก็บเป็น data URL → เปิดในแท็บใหม่ได้ตรง ๆ และสั่งพิมพ์ได้เมื่อต้องการ */
function openSlip(slipDataUrl: string, print: boolean) {
  const win = window.open(slipDataUrl, '_blank')
  if (!win || !print) return
  win.onload = () => {
    win.focus()
    win.print()
  }
}

/**
 * ตาราง "รายการ Top-up ล่าสุด" — ใช้ในหน้า Top up (/dashboard/1/topup)
 * รูปแบบเดียวกับตารางรายการจอง: แบ่งหน้า 5 แถว + ปุ่ม เปิดสลิป (link) · ดูสลิป (view) · พิมพ์สลิป (print)
 * สลิปซ้ำถูกปิดการแสดงผล — สลิปเดียวกันเหลือแถวเดียว (แถวใหม่ที่สุด) เพื่อไม่ให้เห็น record ซ้ำ
 */
export function RecentTopupsTable({ requests, loading, error, onApprove, approvingId }: RecentTopupsTableProps) {
  const [slip, setSlip] = useState<RecentTopUpRow | null>(null)
  /** หน้าปัจจุบันของตาราง — ข้อมูลโหลดมาทั้งหมดแล้ว แบ่งหน้าในเบราว์เซอร์ (5 แถว/หน้า) */
  const [page, setPage] = useState(1)

  /** ปิด record สลิปซ้ำ: สลิปเดียวกัน (slipDataUrl เดียวกัน) แสดงเพียงแถวเดียว — เก็บแถวแรกที่เจอ (ใหม่ที่สุด) */
  const uniqueRequests = useMemo(() => {
    const seen = new Set<string>()
    return requests.filter((request) => {
      if (seen.has(request.slipDataUrl)) return false
      seen.add(request.slipDataUrl)
      return true
    })
  }, [requests])
  /** จำนวน record สลิปซ้ำที่ถูกซ่อนไปจากการแสดงผล */
  const hiddenRepeats = requests.length - uniqueRequests.length
  const { currentPage, rows } = paginate(uniqueRequests, page, TABLE_PAGE_SIZE)

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">รายการ Top-up ล่าสุด</h2>
      <div className="overflow-hidden rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>วันที่</TableHead>
              <TableHead>เวลา</TableHead>
              <TableHead>ผู้ใช้</TableHead>
              <TableHead className="text-right">ยอดเงิน</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  กำลังโหลดรายการ Top-up...
                </TableCell>
              </TableRow>
            )}
            {!loading && uniqueRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {error ? 'โหลดรายการ Top-up ไม่สำเร็จ' : 'ไม่พบรายการ Top-up'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((request) => {
              const displayName = request.user.lineDisplayName || request.user.name || 'ลูกค้า'
              const created = new Date(request.createdAt)
              return (
                <TableRow key={request.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {created.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {created.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{displayName}</div>
                    <div className="text-xs text-muted-foreground">{request.user.phone || '—'}</div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-emerald-700">
                    {formatBaht(request.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${statusMeta(request.status).badgeClass}`}>
                      {statusMeta(request.status).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      {onApprove && request.status === 'pending' && !request.duplicate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-700 hover:bg-emerald-50"
                          title="อนุมัติ"
                          disabled={approvingId === request.id}
                          onClick={() => onApprove(request)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onApprove && request.status === 'pending' && request.duplicate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive/70"
                          title="สลิปซ้ำ — อนุมัติไม่ได้"
                          disabled
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="เปิดสลิป"
                        onClick={() => openSlip(request.slipDataUrl, false)}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-sky-600 hover:bg-sky-50"
                        title="ดูสลิป"
                        onClick={() => setSlip(request)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-700 hover:bg-emerald-50"
                        title="พิมพ์สลิป"
                        onClick={() => openSlip(request.slipDataUrl, true)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* สลิปซ้ำถูกปิดการแสดงผล — บอกจำนวนที่ซ่อนไว้ให้ตรวจสอบได้ */}
      {hiddenRepeats > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          ปิดการแสดงผลสลิปซ้ำ {hiddenRepeats.toLocaleString()} รายการ — สลิปเดียวกันแสดงเพียงแถวเดียว
        </p>
      )}

      {/* แบ่งหน้ารายการ Top-up — 5 แถว/หน้า */}
      <TablePagination
        page={currentPage}
        pageSize={TABLE_PAGE_SIZE}
        total={uniqueRequests.length}
        itemLabel="รายการ Top-up"
        onPageChange={setPage}
      />

      {/* Dialog ดูสลิป */}
      {slip && (
        <Dialog open onOpenChange={(open) => { if (!open) setSlip(null) }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-emerald-600" />
                สลิปเติมเงิน {formatBaht(slip.amount)}
              </DialogTitle>
              <DialogDescription>
                {slip.user.lineDisplayName || slip.user.name || 'ลูกค้า'}
                {slip.user.phone ? ` · ${slip.user.phone}` : ''} · {new Date(slip.createdAt).toLocaleString('th-TH')}
              </DialogDescription>
            </DialogHeader>
            <img
              src={slip.slipDataUrl}
              alt={`สลิปจาก ${slip.slipName}`}
              className="max-h-[60vh] w-full rounded-lg border object-contain"
            />
            <p className="text-xs text-muted-foreground">{slip.slipName}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
