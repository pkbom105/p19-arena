'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Receipt } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getTicketCode } from '@/components/booking/booking-ticket'
import { toast } from 'sonner'
import { MAX_SLIP_SIZE, formatThaiDate, type SlipBooking } from './slip-helpers'

interface SlipAttachDialogProps {
  booking: SlipBooking | null
  onClose: () => void
  onUploaded: () => void
}

/** dialog แนบ/เปลี่ยนสลิปแทนลูกค้า (เช่น รับเงินสดที่เคาน์เตอร์) */
export function SlipAttachDialog({ booking, onClose, onUploaded }: SlipAttachDialogProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setDataUrl(null)
    setFileName(null)
    setError(null)
  }

  const handleFile = (file: File | null) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('รองรับเฉพาะไฟล์รูปภาพ (jpg / png)')
      return
    }
    if (file.size > MAX_SLIP_SIZE) {
      setError(`ไฟล์ใหญ่เกินไป (สูงสุด 300kB) — ไฟล์นี้ ${Math.ceil(file.size / 1024)}kB`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setDataUrl(String(reader.result))
      setFileName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (!booking || !dataUrl) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/bookings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, slipDataUrl: dataUrl, slipName: fileName }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'แนบสลิปไม่สำเร็จ')
      toast.success(`แนบสลิป #${getTicketCode(booking)} แล้ว — กด "ยืนยัน" เพื่อยืนยันการชำระ`)
      reset()
      onUploaded()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'แนบสลิปไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={!!booking}
      onOpenChange={(open) => { if (!open) { reset(); onClose() } }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            {booking?.slipDataUrl ? 'เปลี่ยนสลิป' : 'แนบสลิป'} #{booking ? getTicketCode(booking) : ''}
          </DialogTitle>
          <DialogDescription>
            {booking ? `${booking.playerName} • ${formatThaiDate(booking.bookingDate)} • ${booking.timeSlot.startTime}-${booking.timeSlot.endTime}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="h-9 text-sm file:mr-2 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:text-white"
          />

          {dataUrl && (
            <div className="rounded-lg border bg-muted/30 p-2">
              <img src={dataUrl} alt="ตัวอย่างสลิป" className="mx-auto max-h-56 rounded" />
              <p className="mt-1 text-center text-[11px] text-muted-foreground">{fileName}</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-muted-foreground">รองรับ jpg / png ขนาดไม่เกิน 300kB</p>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">ปิด</Button>
          </DialogClose>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={submit}
            disabled={!dataUrl || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            บันทึกสลิป
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
