'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { generatePromptPayQR } from '@/components/qrcode'
import { ReceiptA5, ReceiptPrintRoot } from './receipt-a5'
import type { ShopBill } from './types'

/**
 * Dialog ใบเสร็จหลังปิดบิล — โชว์ตัวอย่าง A5 แนวตั้ง + ปุ่มพิมพ์ออกกระดาษ
 * (ตัวที่พิมพ์จริงคือสำเนาใน ReceiptPrintRoot ที่ซ่อนไว้นอกจอ)
 */
export function ReceiptDialog({ bill, open, onOpenChange, autoPrint = false }: {
  bill: ShopBill | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** true = สั่งพิมพ์อัตโนมัติเมื่อใบเสร็จพร้อม (ใช้กับปุ่ม "พิมพ์" ในลิสต์บิลล่าสุด) */
  autoPrint?: boolean
}) {
  /** QR พร้อมเลขที่บิลที่สร้าง (กันไม่ให้โชว์/พิมพ์ QR ของบิลเก่าค้าง) */
  const [qr, setQr] = useState<{ no: number; url: string } | null>(null)
  /** timer สั่งพิมพ์ + เลขที่บิลที่พิมพ์ไปแล้ว (ไม่ยกเลิก timer เมื่อ state อื่นเปลี่ยน) */
  const printTimerRef = useRef<number | null>(null)
  const printedBillRef = useRef<number | null>(null)

  // สร้าง PromptPay QR ของยอดบิลนี้ (ตัวเดียวกับที่หน้า booking ใช้)
  useEffect(() => {
    if (!open || !bill) return
    let cancelled = false
    generatePromptPayQR(bill.total)
      .then((url) => {
        if (!cancelled) setQr({ no: bill.no, url })
      })
      .catch((err) => console.error('Failed to generate PromptPay QR', err))
    return () => {
      cancelled = true
    }
  }, [open, bill])

  /** QR ที่ใช้ได้เฉพาะเมื่อเป็นของบิลที่กำลังแสดงอยู่ */
  const qrForThisBill = qr && bill && qr.no === bill.no ? qr.url : null

  // ปุ่ม "พิมพ์" จากลิสต์บิลล่าสุด → สั่งพิมพ์เองหลัง QR ของบิลนี้พร้อม (บิลละ 1 ครั้ง)
  useEffect(() => {
    if (!open || !autoPrint || !bill || !qrForThisBill) return
    if (printedBillRef.current === bill.no) return
    printedBillRef.current = bill.no
    printTimerRef.current = window.setTimeout(() => window.print(), 150)
  }, [open, autoPrint, bill, qrForThisBill])

  // เคลียร์ timer เมื่อออกจาก component และรีเซ็ตสถานะพิมพ์เมื่อปิด dialog
  useEffect(() => () => {
    if (printTimerRef.current) window.clearTimeout(printTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) printedBillRef.current = null
  }, [open])

  if (!bill) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[170mm]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" /> ใบเสร็จรับเงิน · บิล {bill.code}
            </DialogTitle>
            <DialogDescription>
              ใบเสร็จขนาด A5 แนวตั้ง (148×210 มม.) — กดพิมพ์เพื่อออกกระดาษ หรือเลือก “Save as PDF” ในหน้าต่างพิมพ์
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto rounded-lg bg-slate-100 p-3">
            <ReceiptA5 bill={bill} qrDataUrl={qrForThisBill} />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ปิด
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.print()} aria-label="พิมพ์ใบเสร็จ">
              <Printer className="mr-1 h-4 w-4" /> พิมพ์ใบเสร็จ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptPrintRoot bill={bill} qrDataUrl={qrForThisBill} />
    </>
  )
}
