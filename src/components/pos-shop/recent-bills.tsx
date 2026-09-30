'use client'

import { format } from 'date-fns'
import { Eye, Printer, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTHB } from './catalog'

/** ใบเสร็จ 1 ใบจาก /api/shop-receipts (แถว DB + items) — ใช้ทั้งลิสต์นี้และส่งต่อเข้า dialog ใบเสร็จ */
export interface RecentBill {
  id: string
  /** เลขที่บิลที่แสดงให้ลูกค้า รูปแบบ S-YYMM### */
  code: string
  no: number
  subtotal: number
  discount: number
  total: number
  method: string
  received: number
  change: number
  itemCount: number
  soldAt: string
  items: { id: string; name: string; qty: number; price: number }[]
}

/**
 * การ์ด "บิลล่าสุด" — ใบเสร็จ 3 ใบล่าสุดจากการขาย (คนละการ์ดกับตะกร้าแล้ว)
 * แสดงเป็นลิสต์ตลอดเวลา (ไม่ต้องกดเปิด) พร้อมปุ่ม "ดู" ใบเสร็จ A5 และปุ่ม "พิมพ์" ต่อแถว
 */
export function RecentBills({ receipts, loading = false, onView, onPrint }: {
  receipts: RecentBill[]
  loading?: boolean
  onView: (bill: RecentBill) => void
  onPrint: (bill: RecentBill) => void
}) {
  const hasBills = receipts.length > 0

  return (
    <section data-slot="recent-bills" className="space-y-2 rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-emerald-600" /> บิลล่าสุด
        </span>
        <Badge variant="secondary" className="text-xs">{receipts.length}</Badge>
      </div>

      {!hasBills && (
        <p className="text-center text-[11px] text-muted-foreground">
          {loading ? 'กำลังโหลดบิล…' : 'ยังไม่มีบิล — ปิดบิลแรกแล้วจะแสดงที่นี่'}
        </p>
      )}

      {hasBills && (
        <div className="space-y-2">
          {receipts.map((bill) => (
            <div
              key={bill.id}
              data-slot="recent-bill"
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{bill.code}</span>
                  <span className="text-[11px] text-muted-foreground">{format(new Date(bill.soldAt), 'HH:mm')}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {bill.itemCount} ชิ้น · {bill.method === 'cash' ? 'เงินสด' : 'โอน/QR'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-0.5 text-sm font-semibold text-emerald-700">{formatTHB(bill.total)}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onView(bill)}
                  aria-label={`ดูใบเสร็จ ${bill.code}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onPrint(bill)}
                  aria-label={`พิมพ์ใบเสร็จ ${bill.code}`}
                >
                  <Printer className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">แสดง 3 บิลล่าสุด · ดูทั้งหมดได้ที่หน้า shop-report</p>
        </div>
      )}
    </section>
  )
}
