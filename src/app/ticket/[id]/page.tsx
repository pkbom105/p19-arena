import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { TicketBooking } from '@/components/booking/booking-ticket'
import { TicketShareDownload } from '@/components/booking/ticket-share-download'

export const dynamic = 'force-dynamic'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ค้นหาจาก ticketCode 8 หลักก่อน (URL ใหม่) แล้วค่อยค้นจาก id (URL เก่า)
  const booking = await db.booking.findFirst({
    where: {
      OR: [{ ticketCode: id.toUpperCase() }, { id }],
    },
    include: {
      court: { select: { id: true, name: true } },
      timeSlot: { select: { id: true, startTime: true, endTime: true } },
      user: { select: { lineDisplayName: true, name: true } },
    },
  })

  if (!booking) notFound()

  const ticket: TicketBooking = {
    id: booking.id,
    ticketCode: booking.ticketCode,
    bookingDate: booking.bookingDate,
    status: booking.status,
    playerName: booking.playerName,
    playerPhone: booking.playerPhone,
    court: booking.court,
    timeSlot: booking.timeSlot,
  }

  return (
    <main className="min-h-screen bg-emerald-50/60 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-4 text-xs text-muted-foreground">
          บัตรจองสนาม P19 Pickleball Arena
        </div>
        <TicketShareDownload
          booking={ticket}
        />
      </div>
    </main>
  )
}