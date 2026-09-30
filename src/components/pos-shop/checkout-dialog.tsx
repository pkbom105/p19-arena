'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatTHB } from './catalog'
import type { PaymentMethod } from './types'

const methodCls = (on: boolean) =>
  'h-auto flex-col items-start gap-1 border p-3 text-left ' +
  (on ? 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-50' : '')

/** Dialog ชำระเงิน — เลือกวิธีจ่าย, รับเงินสด + คำนวณเงินทอน */
export function CheckoutDialog({ open, total, itemCount, onOpenChange, onConfirm }: {
  open: boolean
  total: number
  itemCount: number
  onOpenChange: (o: boolean) => void
  onConfirm: (p: { method: PaymentMethod; received: number }) => void
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [received, setReceived] = useState(0)

  // เปิดใหม่ทุกรอบ → เริ่มที่เงินสด + ยังไม่กรอกรับเงิน
  useEffect(() => {
    if (open) {
      setMethod('cash')
      setReceived(0)
    }
  }, [open])

  const change = received - total
  const canPay = method === 'transfer' || received >= total

  // ปุ่มลัด: รับเงินพอดี / แบงก์ 500 / 1000
  const quickAmounts = useMemo(
    () => [...new Set([total, 500, 1000])].sort((a, b) => a - b),
    [total]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ชำระเงิน · {itemCount} ชิ้น</DialogTitle>
          <DialogDescription>ยอดสุทธิที่ต้องเก็บจากลูกค้า {formatTHB(total)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className={methodCls(method === 'cash')} onClick={() => setMethod('cash')}>
              <span className="flex items-center gap-1 text-sm font-medium">
                <Banknote className="h-4 w-4" /> เงินสด
              </span>
              <span className="text-[11px] text-muted-foreground">กรอกยอดรับเงิน → คิดเงินทอน</span>
            </Button>
            <Button variant="outline" className={methodCls(method === 'transfer')} onClick={() => setMethod('transfer')}>
              <span className="flex items-center gap-1 text-sm font-medium">
                <Landmark className="h-4 w-4" /> โอน / QR
              </span>
              <span className="text-[11px] text-muted-foreground">รับครบตามยอดสุทธิ</span>
            </Button>
          </div>

          {method === 'cash' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">รับเงินมา</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={received || ''}
                  onChange={(e) => setReceived(Math.max(0, Number(e.target.value) || 0))}
                  className="h-8 w-32 text-right"
                  aria-label="รับเงินมา"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {quickAmounts.map((v) => (
                  <Button key={v} variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReceived(v)}>
                    {formatTHB(v)}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setReceived(0)}>
                  ล้าง
                </Button>
              </div>
              <div className={`flex items-center justify-between rounded-lg border p-3 text-sm ${change < 0 ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
                <span>{change < 0 ? 'รับเงินไม่พอ (ขาดอีก)' : 'เงินทอน'}</span>
                <span className="text-base font-bold">{formatTHB(Math.abs(change))}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">ยอดสุทธิ</span>
            <span className="text-base font-bold text-emerald-700">{formatTHB(total)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">ยกเลิก</Button>
          </DialogClose>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!canPay}
            onClick={() => onConfirm({ method, received: method === 'cash' ? received : total })}
          >
            ยืนยันการชำระเงิน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
