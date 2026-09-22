'use client'

import { useRef, useState } from 'react'
import { Dumbbell, Download, Link2, Loader2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookingTicket } from '@/components/booking/booking-ticket'
import { copyTicketLink } from './helpers'
import type { BookingRow } from './types'

interface TicketViewDialogProps {
  booking: BookingRow
  onClose: () => void
}

/** Dialog "ดูตั๋ว" — แสดงตั๋วการจองเต็มรูปแบบ + ดาวน์โหลด PNG / คัดลอกลิงก์ */
export function TicketViewDialog({ booking, onClose }: TicketViewDialogProps) {
  const ticketWrapRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!ticketWrapRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(ticketWrapRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `p19-ticket-${String(booking.ticketCode || booking.id).toUpperCase()}.png`
      link.href = dataUrl
      link.click()
    } catch {
      // download failed — silent
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-600" />
            ตั๋วการจอง #{String(booking.ticketCode || booking.id).toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            แสดงตั๋วให้ลูกค้า ดาวน์โหลดเป็น PNG หรือคัดลอกลิงก์ตั๋วเพื่อส่งให้ลูกค้า
          </DialogDescription>
        </DialogHeader>

        <div ref={ticketWrapRef} className="py-2">
          <BookingTicket booking={booking} hideActions />
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">ปิด</Button>
          </DialogClose>
          <Button variant="outline" onClick={() => copyTicketLink(booking)}>
            <Link2 className="mr-1 h-4 w-4" /> คัดลอกลิงก์
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            ดาวน์โหลด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
