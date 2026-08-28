'use client'

import { useRef, useState } from 'react'
import { Share2, Download, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { toPng } from 'html-to-image'
import type { TicketBooking } from '@/components/booking/booking-ticket'
import { BookingTicket } from '@/components/booking/booking-ticket'

/** ปุ่มแชร์ลิงก์ + ดาวน์โหลดตั๋ว (มีตัวหนังสือ) สำหรับหน้า /ticket/[id] */
export function TicketShareDownload({
  booking,
  className,
}: {
  booking: TicketBooking
  className?: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('คัดลอกลิงก์แล้ว')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }

  const handleDownload = async () => {
    if (!captureRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(captureRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `ticket-${booking.id.slice(-8).toUpperCase()}.png`
      link.href = dataUrl
      link.click()
      toast.success('ดาวน์โหลดตั๋วสำเร็จ')
    } catch (err) {
      console.error('Failed to export ticket', err)
      toast.error('ดาวน์โหลดไม่สำเร็จ')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div id="ticket-capture" ref={captureRef}>
        <BookingTicketCapture booking={booking} />
      </div>

      <div className={`mt-5 flex flex-col gap-2.5 ${className ?? ''}`}>
        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 text-sm" onClick={handleShare}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
          {copied ? 'คัดลอกแล้ว' : 'แชร์ลิงก์ตั๋ว'}
        </Button>
        <Button variant="outline" className="w-full h-11 text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {downloading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลดตั๋ว (PNG)'}
        </Button>
      </div>
    </>
  )
}

/** การ์ดตั๋วแบบอ่านอย่างเดียว — ใช้ ref ที่ BookingTicket จัดการ capture */
function BookingTicketCapture({ booking }: { booking: TicketBooking }) {
  return <BookingTicket booking={booking} hideActions />
}