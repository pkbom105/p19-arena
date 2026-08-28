'use client'

import { useEffect, useState, useRef, type RefObject } from 'react'
import { Dumbbell, CalendarDays, MapPin, Clock, User, QrCode, Pencil, Ban, Eye, Download, Loader2, Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { generateBookingQR } from '@/components/qrcode'
import { toPng } from 'html-to-image'

/** ข้อมูลการจองขั้นต่ำสำหรับแสดงเป็น ticket (อิงตามการ์ดอ้างอิง public/ref/ticket.png) */
export interface TicketBooking {
  id: string
  ticketCode?: string | null
  bookingDate: string
  status: string
  playerName: string
  playerPhone: string
  court: { id: string; name: string }
  timeSlot: { id: string; startTime: string; endTime: string }
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/**
 * รหัสตั๋ว 8 หลัก (4 ตัวอักษร + 4 ตัวเลข)
 * ใช้ ticketCode จาก DB เป็นหลัก; ถ้าไม่มี (ข้อมูลเก่า) ให้คำนวณจาก id แบบ deterministic
 */
export function getTicketCode(booking: Pick<TicketBooking, 'id' | 'ticketCode'>): string {
  if (booking.ticketCode) return booking.ticketCode.toUpperCase()
  const id = booking.id
  const letters = (id.replace(/[^a-zA-Z]/g, '') + 'PPPP').slice(0, 4).toUpperCase()
  const digits = ('0000' + id.replace(/[^0-9]/g, '')).slice(-4)
  return `${letters}${digits}`
}

/** สร้างข้อความสำหรับ QR — ข้อมูลจองทั้งหมด */
function ticketPayload(b: TicketBooking) {
  return [
    'P19 Pickleball Arena',
    `รหัสจอง: ${getTicketCode(b)}`,
    `วันที่: ${b.bookingDate}`,
    `สนาม: ${b.court.name}`,
    `เวลา: ${b.timeSlot.startTime} - ${b.timeSlot.endTime}`,
    `ชื่อ: ${b.playerName}`,
    `โทร: ${b.playerPhone}`,
  ].join('\n')
}

/** การ์ดตั๋วการจอง (อ้างอิงลายตั๋ว public/ref/ticket.png) */
export function BookingTicket({
  booking,
  onEdit,
  onCancel,
  onCopyLink,
  hideActions = false,
}: {
  booking: TicketBooking
  onEdit?: () => void
  onCancel?: () => void
  onCopyLink?: () => void
  hideActions?: boolean
}) {
  const [qr, setQr] = useState<string | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [viewDownloading, setViewDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const viewTicketRef = useRef<HTMLDivElement>(null)
  const cancelled = booking.status === 'cancelled'

  useEffect(() => {
    let active = true
    generateBookingQR(ticketPayload(booking))
      .then((url) => { if (active) setQr(url) })
      .catch(() => {})
    return () => { active = false }
  }, [booking.id, booking.bookingDate, booking.timeSlot.startTime])

  const exportPng = async (el: HTMLDivElement | null, filename: string) => {
    if (!el) throw new Error('no element')
    const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff' })
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await exportPng(cardRef.current, `ticket-${getTicketCode(booking)}.png`)
      toast.success('ดาวน์โหลดตั๋วสำเร็จ')
    } catch (err) {
      console.error('Failed to export ticket', err)
      toast.error('ดาวน์โหลดไม่สำเร็จ')
    } finally {
      setDownloading(false)
    }
  }

  const handleViewDownload = async () => {
    setViewDownloading(true)
    try {
      await exportPng(viewTicketRef.current, `ticket-${getTicketCode(booking)}.png`)
      toast.success('ดาวน์โหลดตั๋วสำเร็จ')
    } catch (err) {
      console.error('Failed to export ticket', err)
      toast.error('ดาวน์โหลดไม่สำเร็จ')
    } finally {
      setViewDownloading(false)
    }
  }

  const renderTicket = (refEl: RefObject<HTMLDivElement | null>) => (
    <div
      ref={refEl}
      className={`relative flex flex-col aspect-[5/6] w-full overflow-hidden rounded-2xl border bg-white text-slate-800 shadow-sm ${
        cancelled ? 'opacity-55 saturate-50 border-slate-300' : 'border-emerald-200'
      }`}
    >
      {/* แถบหัวตั๋ว */}
      <div className={`flex items-center justify-between px-4 py-2.5 text-white ${cancelled ? 'bg-slate-400' : 'bg-emerald-600'}`}>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4" />
          <span className="text-sm font-bold tracking-wide">P19 Pickleball Arena</span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-widest opacity-90">
          บัตรจองสนาม
        </span>
      </div>

      {/* ส่วนหลัก (กลางตั๋ว) */}
      <div className="flex-1 min-h-0 p-4 flex flex-col space-y-2.5">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700 leading-snug">{formatDate(booking.bookingDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm font-medium leading-snug">{booking.court?.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm leading-snug">{booking.timeSlot?.startTime} - {booking.timeSlot?.endTime} น.</span>
        </div>
        <div className="flex items-start gap-1.5">
          <User className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
          <span className="text-sm leading-snug break-words">{booking.playerName}<br /><span className="text-xs text-slate-500">{booking.playerPhone}</span></span>
        </div>
        <div className="pt-1">
          <Badge variant={cancelled ? 'destructive' : 'secondary'} className="text-[10px]">
            {cancelled ? 'ยกเลิก' : booking.status === 'confirmed' ? 'ยืนยันแล้ว' : booking.status}
          </Badge>
        </div>
      </div>

      {/* เส้นฉีกตั๋ว (แนวนอน) */}
      <div className="relative px-0">
        <div className={`border-t-2 border-dashed ${cancelled ? 'border-slate-300' : 'border-emerald-200'}`} />
        <div className={`absolute -top-2 left-0 -translate-x-1/2 w-4 h-4 rounded-full ${cancelled ? 'bg-slate-100' : 'bg-emerald-50'}`} />
        <div className={`absolute -top-2 right-0 translate-x-1/2 w-4 h-4 rounded-full ${cancelled ? 'bg-slate-100' : 'bg-emerald-50'}`} />
      </div>

      {/* สตับ QR (ล่าง) */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-20 h-20 bg-white border rounded-lg p-1 shrink-0">
          {qr ? (
            <img src={qr} alt="QR การจอง" className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <QrCode className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-[10px] text-slate-500 leading-snug">
          <div className="font-semibold text-xs text-slate-700">รหัสตั๋ว #{getTicketCode(booking)}</div>
          <div className="mt-0.5">สแกน QR เพื่อยืนยันการจอง</div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div>
        {renderTicket(cardRef)}

        {!hideActions && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {onEdit && !cancelled && (
                <Button size="icon" variant="outline" className="h-7 w-7 text-emerald-600" onClick={onEdit} aria-label="แก้ไข">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onCancel && !cancelled && (
                <Button size="icon" variant="outline" className="h-7 w-7 border-red-200 text-red-600 hover:bg-red-50" onClick={onCancel} aria-label="ยกเลิก">
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {onCopyLink && (
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={onCopyLink} aria-label="คัดลอกลิงก์ตั๋ว">
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setViewOpen(true)} aria-label="ดูตั๋ว">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700" onClick={handleDownload} disabled={downloading} aria-label="ดาวน์โหลด">
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {!hideActions && (
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-emerald-600" />
                ตั๋วการจอง #{getTicketCode(booking)}
              </DialogTitle>
              <DialogDescription>
                ตรวจสอบรายละเอียดตั๋ว หรือดาวน์โหลดเพื่อนำไปแสดงที่สนาม
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {renderTicket(viewTicketRef)}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">ปิด</Button>
              </DialogClose>
              <Button size="icon" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleViewDownload} disabled={viewDownloading} aria-label="ดาวน์โหลดตั๋ว">
                {viewDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}