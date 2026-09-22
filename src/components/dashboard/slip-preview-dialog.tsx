'use client'

import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getTicketCode } from '@/components/booking/booking-ticket'
import { formatThaiDate, type SlipBooking } from './slip-helpers'

interface SlipPreviewDialogProps {
  booking: SlipBooking | null
  onClose: () => void
  onDownload: (b: SlipBooking) => void
}

/** dialog ดูสลิปขนาดเต็ม + ดาวน์โหลด */
export function SlipPreviewDialog({ booking, onClose, onDownload }: SlipPreviewDialogProps) {
  return (
    <Dialog open={!!booking} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            สลิปการชำระ #{booking ? getTicketCode(booking) : ''}
          </DialogTitle>
          <DialogDescription>
            {booking ? `${booking.playerName} • ${formatThaiDate(booking.bookingDate)} • ${booking.timeSlot.startTime}-${booking.timeSlot.endTime} • ${booking.court.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        {booking?.slipDataUrl && (
          <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 p-2">
            <img src={booking.slipDataUrl} alt={`สลิป ${getTicketCode(booking)}`} className="mx-auto max-w-full rounded" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">ปิด</Button>
          </DialogClose>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => { if (booking) onDownload(booking) }}
          >
            ดาวน์โหลดสลิป
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
