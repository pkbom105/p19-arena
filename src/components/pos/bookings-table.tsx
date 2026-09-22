'use client'

import { useState } from 'react'
import { Ban, CalendarDays, Eye, Link2, Pencil, Search } from 'lucide-react'
import type { PriceRule } from '@/lib/price'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bookingPrice, copyTicketLink, formatThaiDate, statusMeta } from './helpers'
import { TicketViewDialog } from './ticket-view-dialog'
import type { BookingRow, Court } from './types'

interface BookingsTableProps {
  bookings: BookingRow[]
  courts: Court[]
  priceRules: PriceRule[]
  date: string
  search: string
  onSearchChange: (v: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  courtFilter: string
  onCourtFilterChange: (v: string) => void
  dateScope: 'all' | 'date'
  onDateScopeToggle: () => void
  onEditBooking: (b: BookingRow) => void
  onCancelBooking: (id: string) => void
}

/** รายการจองทั้งหมด — ตาราง + ตัวกรอง (ค้นหา / สถานะ / สนาม / ขอบเขตวันที่) */
export function BookingsTable({
  bookings, courts, priceRules, date,
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  courtFilter, onCourtFilterChange,
  dateScope, onDateScopeToggle,
  onEditBooking, onCancelBooking,
}: BookingsTableProps) {
  // Dialog: ดูตั๋วการจอง
  const [ticketBooking, setTicketBooking] = useState<BookingRow | null>(null)

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์ / รหัสตั๋ว"
            className="h-9 w-64 pl-8 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">ทุกสถานะ</option>
          <option value="confirmed">ยืนยันแล้ว</option>
          <option value="pending">รอชำระ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
        <select
          value={courtFilter}
          onChange={(e) => onCourtFilterChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">ทุกสนาม</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button
          variant={dateScope === 'date' ? 'default' : 'outline'}
          size="sm"
          className="h-9 text-xs"
          onClick={onDateScopeToggle}
        >
          <CalendarDays className="mr-1 h-3.5 w-3.5" />
          {dateScope === 'date' ? formatThaiDate(date) : 'ทุกวัน'}
        </Button>
        <Badge variant="secondary" className="text-xs">{bookings.length} รายการ</Badge>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>วันที่</TableHead>
              <TableHead>เวลา</TableHead>
              <TableHead>สนาม</TableHead>
              <TableHead>ผู้เล่น</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">ราคา</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id} className={b.status === 'cancelled' ? 'opacity-60' : ''}>
                <TableCell className="whitespace-nowrap text-sm">{formatThaiDate(b.bookingDate)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm font-medium">
                  {b.timeSlot?.startTime} - {b.timeSlot?.endTime}
                </TableCell>
                <TableCell className="text-sm">{b.court?.name}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{b.playerName}</div>
                  <div className="text-xs text-muted-foreground">{b.playerPhone}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${statusMeta(b.status).badgeClass}`}>
                    {statusMeta(b.status).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">฿{bookingPrice(b, courts, priceRules).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" title="แก้ไขการจอง" onClick={() => onEditBooking(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-sky-600 hover:bg-sky-50" title="ดูตั๋ว" onClick={() => setTicketBooking(b)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {b.status !== 'cancelled' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" title="ยกเลิกการจอง" onClick={() => onCancelBooking(b.id)}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="คัดลอกลิงก์ตั๋ว" onClick={() => copyTicketLink(b)}>
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  ไม่พบรายการจอง
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog: ดูตั๋ว */}
      {ticketBooking && (
        <TicketViewDialog
          booking={ticketBooking}
          onClose={() => setTicketBooking(null)}
        />
      )}
    </div>
  )
}
