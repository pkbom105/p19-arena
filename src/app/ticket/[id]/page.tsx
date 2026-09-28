import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { TicketBooking } from '@/components/booking/booking-ticket'
import { TicketShareDownload } from '@/components/booking/ticket-share-download'
import { getCoachMapByBookingIds } from '@/lib/coach-ticket'
import { buildTicketViews } from '@/lib/ticket-group'

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

  /**
   * ตั๋วใบนี้อยู่ในกลุ่ม "สนามเดิม + วันเดิม + ผู้จองคนเดิม + เวลาติดกัน" กับแถวไหนบ้าง
   * — เวลาต่อเนื่องถูกรวมเป็นตั๋วใบเดียว (แสดงเป็นช่วงเวลาเดียว) ส่วนคนละช่วง/ยกเลิก แยกใบตามเดิม
   */
  const siblings = await db.booking.findMany({
    where: {
      courtId: booking.courtId,
      bookingDate: booking.bookingDate,
      playerPhone: booking.playerPhone,
    },
    include: {
      court: { select: { id: true, name: true } },
      timeSlot: { select: { id: true, startTime: true, endTime: true } },
    },
  })
  /**
   * แนบข้อมูลโค้ชลงทุกแถวของกลุ่ม แล้วให้ตัวช่วยเดียวกับหน้าอื่น (buildTicketViews) สรุปเป็น "ตั๋วใบเดียว"
   *  - เวลา/ชั่วโมง = ช่วงรวมของกลุ่ม, โค้ช = เฉพาะชั่วโมงที่ติ๊กและอยู่ในช่วงเวลาของใบนี้
   *  - รหัสที่แสดง = รหัสของแถวแรกสุด (lead) → ทุก URL ในกลุ่มเดียวกันเห็นรหัสเดียวกัน
   */
  const coachMap = await getCoachMapByBookingIds(siblings.map((row) => row.id))
  const rowsWithCoach = siblings.map((row) => ({ ...row, coach: coachMap.get(row.id) ?? null }))
  const view = buildTicketViews(rowsWithCoach).find((v) => v.rows.some((row) => row.id === booking.id)) ?? null

  const ticket: TicketBooking = {
    id: booking.id,
    ticketCode: view?.lead.ticketCode ?? booking.ticketCode,
    bookingDate: booking.bookingDate,
    status: booking.status,
    playerName: booking.playerName,
    playerPhone: booking.playerPhone,
    court: booking.court,
    timeSlot: {
      ...booking.timeSlot,
      startTime: view?.startTime ?? booking.timeSlot.startTime,
      endTime: view?.endTime ?? booking.timeSlot.endTime,
    },
    slotCount: view?.slotCount ?? 1,
    coach: view?.coach ?? null,
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