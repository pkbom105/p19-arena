'use client'

import {
  CalendarDays, CheckCircle2, Clock, Loader2, MapPin, Phone, Receipt, User, XCircle, ZoomIn,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getTicketCode } from '@/components/booking/booking-ticket'
import { formatThaiDate, statusMeta, type SlipBooking } from './slip-helpers'

interface SlipTableProps {
  rows: SlipBooking[]
  busyId: string | null
  onPreview: (b: SlipBooking) => void
  onUpload: (b: SlipBooking) => void
  onPatch: (b: SlipBooking, payload: Record<string, unknown>, successMsg: string) => void
}

/** ตารางรายการสลิป — ใช้ในหน้า Dashboard → Slip Upload */
export function SlipTable({ rows, busyId, onPreview, onUpload, onPatch }: SlipTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">วัน / เวลา</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ลูกค้า</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">สนาม</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">สลิป</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">สถานะ</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const meta = statusMeta(b.status)
            const busy = busyId === b.id
            return (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatThaiDate(b.bookingDate)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {b.timeSlot.startTime} - {b.timeSlot.endTime}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {b.playerName}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {b.playerPhone}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {b.court.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    #{getTicketCode(b)}
                    {b.racketCount ? ` • ไม้ ${b.racketCount}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  {b.slipDataUrl ? (
                    <button type="button" onClick={() => onPreview(b)} title="ดูสลิป" className="group relative block">
                      <img
                        src={b.slipDataUrl}
                        alt={`สลิป ${getTicketCode(b)}`}
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
                <td className="px-3 py-2 align-middle">
                  <Badge variant="outline" className={`text-[11px] ${meta.className}`}>{meta.label}</Badge>
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center justify-end gap-1.5">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {b.slipDataUrl && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => onPreview(b)}>
                            <ZoomIn className="h-3.5 w-3.5" /> ดูสลิป
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => onUpload(b)}>
                          <Receipt className="h-3.5 w-3.5" /> {b.slipDataUrl ? 'เปลี่ยนสลิป' : 'แนบสลิป'}
                        </Button>
                        {b.status !== 'confirmed' && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 bg-emerald-600 text-[11px] hover:bg-emerald-700"
                            onClick={() => onPatch(b, { status: 'confirmed' }, `ยืนยันการชำระ #${getTicketCode(b)} แล้ว`)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยัน
                          </Button>
                        )}
                        {b.slipDataUrl && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 border-red-200 text-red-600 hover:bg-red-50"
                            title="ลบสลิป"
                            onClick={() => onPatch(b, { slipDataUrl: null, slipName: null }, 'ลบสลิปแล้ว')}
                          >
                            <XCircle className="h-3.5 w-3.5" />
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
  )
}
