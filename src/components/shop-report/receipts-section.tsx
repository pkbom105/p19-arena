'use client'

import { Fragment, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, BarChart3, ChevronDown, ClipboardList, Printer, Receipt, Search, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTHB } from '@/components/pos-shop/catalog'
import type { ShopBill } from '@/components/pos-shop/types'
import { ReceiptDialog } from '@/components/pos-shop/receipt-dialog'
import { StatCard } from './stat-card'

/** ช่วงเวลาของตารางใบเสร็จ */
export type ReceiptRange = 'today' | '7d' | 'all'

/** ป้ายชื่อช่วงเวลาของตัวกรองใบเสร็จ */
const RECEIPT_RANGE_LABEL: Record<ReceiptRange, string> = { today: 'วันนี้', '7d': '7 วัน', all: 'ทั้งหมด' }

/** รายการสินค้าในใบเสร็จ 1 ใบ */
export interface ShopReceiptItemRow {
  id: string
  name: string
  qty: number
  price: number
  note?: string | null
}

/** ใบเสร็จที่บันทึกในตาราง ShopReceipt */
export interface ShopReceiptRow {
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
  items: ShopReceiptItemRow[]
}

/**
 * sub-menu "ใบเสร็จ จาก pos-shop" ของหน้า /dashboard/shop/shop-report
 * การ์ดยอดขาย + ตัวกรองช่วงเวลา/ค้นหา + ตารางบิล + ใบเสร็จ A5 (ReceiptDialog)
 */
export function ReceiptsSection({ receipts, loading, error }: {
  receipts: ShopReceiptRow[]
  loading: boolean
  error: string | null
}) {
  const [receiptRange, setReceiptRange] = useState<ReceiptRange>('today')
  const [receiptSearch, setReceiptSearch] = useState('')
  /** บิลที่กำลังเปิดใบเสร็จ A5 (ดู/พิมพ์) + true = สั่งพิมพ์อัตโนมัติ */
  const [receiptBill, setReceiptBill] = useState<ShopBill | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)
  /** บิลที่กางรายละเอียดแบบ inline ในตาราง (ปุ่ม chevron) */
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null)

  /** ใบเสร็จหลังกรองตามช่วงเวลา + คำค้นหา (เลขที่บิล / ชื่อสินค้า) */
  const visibleReceipts = useMemo(() => {
    const from = (() => {
      if (receiptRange === 'all') return null
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      if (receiptRange === '7d') d.setDate(d.getDate() - 6)
      return d
    })()
    const q = receiptSearch.trim().toLowerCase()
    return receipts
      .filter((r) => !from || new Date(r.soldAt) >= from)
      .filter((r) => !q || String(r.no).includes(q) || r.items.some((i) => i.name.toLowerCase().includes(q)))
  }, [receipts, receiptRange, receiptSearch])

  /** สรุปยอดขายตามตัวกรองที่เลือก */
  const receiptStats = useMemo(() => {
    const sales = visibleReceipts.reduce((sum, r) => sum + r.total, 0)
    const items = visibleReceipts.reduce((sum, r) => sum + r.itemCount, 0)
    const cash = visibleReceipts.filter((r) => r.method === 'cash').reduce((sum, r) => sum + r.total, 0)
    return {
      sales,
      bills: visibleReceipts.length,
      items,
      cash,
      transfer: sales - cash,
      avg: visibleReceipts.length > 0 ? Math.round(sales / visibleReceipts.length) : 0,
    }
  }, [visibleReceipts])

  /** เปิดใบเสร็จ A5 ของบิลในตาราง (map แถว DB → รูปแบบบิลของหน้าแคชเชียร์) · print = สั่งพิมพ์เอง */
  const openReceipt = (row: ShopReceiptRow, print = false) => {
    setAutoPrint(print)
    setReceiptBill({
      code: row.code,
      no: row.no,
      items: row.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, note: i.note ?? undefined })),
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      method: row.method === 'transfer' ? 'transfer' : 'cash',
      received: row.received,
      change: row.change,
      at: row.soldAt,
    })
  }

  return (
    <>
{error && (
  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{error}</span>
  </div>
)}

{/* สรุปยอดขายตามตัวเลือกตัวกรอง */}
<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
  <StatCard
    icon={<TrendingUp className="h-4 w-4" />}
    label="ยอดขาย (ตามตัวกรอง)"
    value={formatTHB(receiptStats.sales)}
    sub={`เงินสด ${formatTHB(receiptStats.cash)} · โอน ${formatTHB(receiptStats.transfer)}`}
  />
  <StatCard
    icon={<Receipt className="h-4 w-4" />}
    label="บิลที่ปิดแล้ว"
    value={`${receiptStats.bills}`}
    sub={`โหลดมา ${receipts.length} ใบ (บันทึกใน DB)`}
  />
  <StatCard
    icon={<ClipboardList className="h-4 w-4" />}
    label="ชิ้นที่ขายได้"
    value={`${receiptStats.items}`}
    sub={`เฉลี่ย ${formatTHB(receiptStats.avg)} / บิล`}
  />
  <StatCard
    icon={<BarChart3 className="h-4 w-4" />}
    label="ช่วงข้อมูลที่แสดง"
    value={RECEIPT_RANGE_LABEL[receiptRange]}
    sub="บันทึกอัตโนมัติเมื่อปิดบิลที่ pos-shop"
  />
</div>

<Card>
  <CardHeader className="space-y-3 pb-3">
    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
        <Receipt className="h-4 w-4 text-emerald-600" /> ตารางใบเสร็จ จาก pos-shop
        <Badge variant="secondary" className="text-xs">{visibleReceipts.length} ใบ</Badge>
    </CardTitle>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1">
        {(Object.keys(RECEIPT_RANGE_LABEL) as ReceiptRange[]).map((r) => (
          <Button
            key={r}
            variant={receiptRange === r ? 'default' : 'outline'}
            size="sm"
            className={'h-7 text-xs ' + (receiptRange === r ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
            onClick={() => setReceiptRange(r)}
          >
            {RECEIPT_RANGE_LABEL[r]}
          </Button>
        ))}
      </div>
      <span className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={receiptSearch}
          onChange={(e) => setReceiptSearch(e.target.value)}
          placeholder="ค้นหาเลขที่บิล/สินค้า…"
          className="h-8 w-full pl-7 text-xs"
          aria-label="ค้นหาใบเสร็จ"
        />
      </span>
    </div>
  </CardHeader>
  <CardContent className="pt-0">
    <Table className="min-w-[900px] table-fixed">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[14%]">วันที่ / เลขที่บิล</TableHead>
          <TableHead className="w-[24%]">รายการสินค้า</TableHead>
          <TableHead className="w-[10%]">ชำระโดย</TableHead>
          <TableHead className="w-[11%] text-right">ก่อนลด</TableHead>
          <TableHead className="w-[10%] text-right">ส่วนลด</TableHead>
          <TableHead className="w-[11%] text-right">ยอดสุทธิ</TableHead>
          <TableHead className="w-[12%] text-right">รับ / ทอน</TableHead>
          <TableHead className="w-[8%] text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleReceipts.map((r) => {
          const itemNames = r.items.map((i) => `${i.name} × ${i.qty}`).join(', ')
          const expanded = expandedReceiptId === r.id
          return (
            <Fragment key={r.id}>
              <TableRow data-slot="receipt-row">
                <TableCell>
                  <div className="font-semibold">{r.code}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(r.soldAt), 'dd/MM/yyyy HH:mm')}</div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="line-clamp-2 text-sm" title={itemNames}>{itemNames}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.itemCount} ชิ้น</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="whitespace-nowrap">{r.method === 'cash' ? 'เงินสด' : 'โอน/QR'}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatTHB(r.subtotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.discount ? `-${formatTHB(r.discount)}` : '—'}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700 tabular-nums">{formatTHB(r.total)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{formatTHB(r.received)}</div>
                  {r.change > 0 && <div className="text-xs text-muted-foreground">ทอน {formatTHB(r.change)}</div>}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setExpandedReceiptId((cur) => (cur === r.id ? null : r.id))}
                      aria-label={`ดูรายการ ${r.code}`}
                      aria-expanded={expanded}
                    >
                      <ChevronDown className={'h-3.5 w-3.5 transition-transform ' + (expanded ? 'rotate-180' : '')} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openReceipt(r)}
                      aria-label={`ดู/พิมพ์ใบเสร็จ ${r.code}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expanded && (
                <TableRow data-slot="receipt-detail-row" className="hover:bg-transparent">
                  <TableCell colSpan={8} className="bg-muted/20 p-0">
                    <Collapsible open>
                      <CollapsibleContent>
                        <div className="space-y-2 px-4 py-3">
                          <div className="text-xs font-semibold text-muted-foreground">รายการสินค้าในบิล {r.code}</div>
                          <div className="divide-y rounded-md border bg-white">
                            {r.items.map((i) => (
                              <div key={i.id} className="grid grid-cols-[1fr_4rem_6rem] items-center gap-3 px-3 py-1.5 text-sm">
                                <span className="min-w-0">
                                  <span className="font-medium">{i.name}</span>
                                  {i.note && <span className="ml-1 text-xs text-muted-foreground">({i.note})</span>}
                                </span>
                                <span className="text-right tabular-nums text-muted-foreground">× {i.qty}</span>
                                <span className="text-right tabular-nums">{formatTHB(i.price * i.qty)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>ก่อนลด {formatTHB(r.subtotal)}</span>
                            <span>ส่วนลด {formatTHB(r.discount)}</span>
                            <span className="font-semibold text-emerald-700">ยอดสุทธิ {formatTHB(r.total)}</span>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          )
        })}
        {loading && receipts.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">กำลังโหลดใบเสร็จ…</TableCell>
          </TableRow>
        )}
        {!loading && visibleReceipts.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="h-28 whitespace-normal text-center text-muted-foreground">
              ยังไม่มีใบเสร็จในช่วงนี้ — ปิดบิลที่หน้า pos-shop แล้วกดรีเฟรชมุมขวาบน
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </CardContent>
</Card>

{/* ใบเสร็จ A5 (ดู/พิมพ์) — ใช้ component เดียวกับหน้า pos-shop */}
<ReceiptDialog
  bill={receiptBill}
  open={Boolean(receiptBill)}
  autoPrint={autoPrint}
  onOpenChange={(open) => {
    if (!open) {
      setReceiptBill(null)
      setAutoPrint(false)
    }
  }}
/>
    </>
  )
}
