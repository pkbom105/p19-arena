'use client'

import { useState } from 'react'
import { Eye, Link2, Printer } from 'lucide-react'
import { BASE_PATH } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TicketViewDialog } from '@/components/pos/ticket-view-dialog'
import { copyTicketLink, formatThaiDate, statusMeta } from '@/components/pos/helpers'
import type { BookingRow } from '@/components/pos/types'
import { TABLE_PAGE_SIZE, TablePagination, paginate } from './table-pagination'

interface RecentBookingsTableProps {
  /** รายการจองล่าสุดทั้งหมด (ตารางแบ่งหน้าเอง หน้าละ 5 แถว) */
  bookings: BookingRow[]
  loading: boolean
}

/**
 * ตาราง "รายการจองล่าสุด" — ใช้ในหน้า Top up (/dashboard/1/topup)
 * แต่ละแถวมีปุ่ม: คัดลอกลิงก์ตั๋ว (link) · ดูตั๋ว (view) · พิมพ์ตั๋ว (print)
 */
export function RecentBookingsTable({ bookings, loading }: RecentBookingsTableProps) {
  const [ticketBooking, setTicketBooking] = useState<BookingRow | null>(null)
  /** หน้าปัจจุบันของตาราง — ข้อมูลโหลดมาทั้งหมดแล้ว แบ่งหน้าในเบราว์เซอร์ (5 แถว/หน้า) */
  const [page, setPage] = useState(1)
  const { currentPage, rows } = paginate(bookings, page, TABLE_PAGE_SIZE)

  /** พิมพ์ตั๋ว = เปิดหน้าตั๋ว /ticket/<code> ในหน้าต่างใหม่แล้วสั่งพิมพ์ (ใช้หน้าตั๋วเดิมของระบบ) */
  const printTicket = (booking: BookingRow) => {
    const code = booking.ticketCode || booking.id
    const win = window.open(`${BASE_PATH}/ticket/${code}`, '_blank')
    if (!win) return
    win.onload = () => {
      win.focus()
      win.print()
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">รายการจองล่าสุด</h2>
      <div className="overflow-hidden rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>วันที่</TableHead>
              <TableHead>เวลา</TableHead>
              <TableHead>สนาม</TableHead>
              <TableHead>ผู้เล่น</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  กำลังโหลดรายการจอง...
                </TableCell>
              </TableRow>
            )}
            {!loading && bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  ไม่พบรายการจอง
                </TableCell>
              </TableRow>
            )}
            {rows.map((booking) => (
              <TableRow key={booking.id} className={booking.status === 'cancelled' ? 'opacity-60' : ''}>
                <TableCell className="whitespace-nowrap text-sm">{formatThaiDate(booking.bookingDate)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm font-medium">
                  {booking.timeSlot?.startTime} - {booking.timeSlot?.endTime}
                </TableCell>
                <TableCell className="text-sm">{booking.court?.name}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{booking.playerName}</div>
                  <div className="text-xs text-muted-foreground">{booking.playerPhone}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${statusMeta(booking.status).badgeClass}`}>
                    {statusMeta(booking.status).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="คัดลอกลิงก์ตั๋ว"
                      onClick={() => void copyTicketLink(booking)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-sky-600 hover:bg-sky-50"
                      title="ดูตั๋ว"
                      onClick={() => setTicketBooking(booking)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-700 hover:bg-emerald-50"
                      title="พิมพ์ตั๋ว"
                      onClick={() => printTicket(booking)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* แบ่งหน้ารายการจอง — 5 แถว/หน้า */}
      <TablePagination
        page={currentPage}
        pageSize={TABLE_PAGE_SIZE}
        total={bookings.length}
        itemLabel="รายการจอง"
        onPageChange={setPage}
      />

      {/* Dialog ดูตั๋ว (ใช้คอมโพเนนต์เดิมของโปรเจกต์) */}
      {ticketBooking && <TicketViewDialog booking={ticketBooking} onClose={() => setTicketBooking(null)} />}
    </div>
  )
}
