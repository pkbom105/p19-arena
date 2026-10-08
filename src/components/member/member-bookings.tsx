'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, History, Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookingTicket, type TicketBooking } from '@/components/booking/booking-ticket'
import { buildTicketViews, mergeTicketView } from '@/lib/ticket-group'

/**
 * เวลาสิ้นสุดของตั๋ว (วันที่จอง + เวลาจบของสล็อต) เป็น timestamp ท้องถิ่น
 * ใช้แบ่งแท็บ "ปัจจุบัน / ผ่านไปแล้ว" — ใช้เวลาจบ เพื่อให้ตั๋วที่กำลังเล่นอยู่ถือว่าเป็นปัจจุบัน
 */
function ticketEndTimestamp(booking: TicketBooking): number {
  const [y, m, d] = (booking.bookingDate || '').split('-').map(Number)
  const [hh, mm] = (booking.timeSlot?.endTime || '00:00').split(':').map(Number)
  if (!y || !m || !d) return 0
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime()
}

/** การ์ดตั๋ว 1 ใบ — ใช้การ์ดเดียวกับหน้า /check และหน้าตั๋ว (รวมช่องเวลาติดกันเป็นใบเดียวแล้ว) */
function TicketCards({ tickets, emptyText }: { tickets: { lead: TicketBooking; booking: TicketBooking }[]; emptyText: string }) {
  if (tickets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      {tickets.map(({ lead, booking }) => (
        <div key={lead.id} className="space-y-1.5">
          {lead.status === 'cancelled' && (
            <Badge variant="outline" className="text-xs text-rose-600">ยกเลิกแล้ว</Badge>
          )}
          <BookingTicket booking={booking} ticketHref={apiUrl(`/ticket/${lead.ticketCode || lead.id}`)} />
        </div>
      ))}
    </div>
  )
}

/**
 * ตั๋วการจองของเจ้าของบัญชีที่ล็อกอิน — 2 แท็บ: ปัจจุบัน / ผ่านไปแล้ว
 * ดึงจาก GET /api/my-bookings (ไม่ส่งพารามิเตอร์ = ใช้เซสชันของผู้ใช้)
 */
export function MemberBookings() {
  const [rows, setRows] = useState<TicketBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/my-bookings'), { cache: 'no-store' })
        if (!response.ok) throw new Error(`Unable to load bookings (${response.status})`)
        const result: unknown = await response.json()
        if (!Array.isArray(result)) throw new Error('Invalid bookings response')
        if (!cancelled) setRows(result as TicketBooking[])
      } catch (loadError) {
        console.error('Failed to load member bookings', loadError)
        if (!cancelled) setError('โหลดตั๋วการจองไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const { current, past } = useMemo(() => {
    const now = Date.now()
    const tickets = buildTicketViews(rows).map((view) => ({
      lead: view.lead,
      booking: mergeTicketView(view.lead, view),
      endAt: ticketEndTimestamp(view.lead),
    }))
    return {
      current: tickets.filter((t) => t.endAt >= now).sort((a, b) => a.endAt - b.endAt),
      past: tickets.filter((t) => t.endAt < now).sort((a, b) => b.endAt - a.endAt),
    }
  }, [rows])

  return (
    <section className="mt-8">
      <h2 className="text-base font-bold">ตั๋วการจองของฉัน</h2>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : error ? (
        <Card className="mt-3 border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="current" className="mt-3 w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current" className="gap-1.5 text-sm">
              <CalendarClock className="h-4 w-4" />
              ปัจจุบัน ({current.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-1.5 text-sm">
              <History className="h-4 w-4" />
              ผ่านไปแล้ว ({past.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="current" className="mt-3">
            <TicketCards tickets={current} emptyText="ยังไม่มีการจองที่กำลังจะถึง" />
          </TabsContent>
          <TabsContent value="past" className="mt-3">
            <TicketCards tickets={past} emptyText="ยังไม่มีการจองที่ผ่านไปแล้ว" />
          </TabsContent>
        </Tabs>
      )}
    </section>
  )
}
