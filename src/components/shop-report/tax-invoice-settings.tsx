'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Eye, FileText, Loader2, Printer, RotateCcw, Save, Shrink } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { TaxInvoiceA4, TaxInvoicePrintRoot, type TaxInvoiceBuyer, type TaxInvoiceItem } from './tax-invoice-a4'
import { formatTHB } from '@/components/pos-shop/catalog'
import {
  DEFAULT_TAX_INVOICE_SELLER,
  TAX_INVOICE_SELLER_KEYS,
  taxInvoiceNo,
  taxInvoiceSellerFromSettings,
  type TaxInvoiceSeller,
} from '@/lib/tax-invoice'

/** รายการตัวอย่างในตัวอย่างใบกำกับ (ตัวอย่างเพื่อดูรูปแบบ ยังไม่ผูกกับบิลจริง) */
const SAMPLE_ITEMS: TaxInvoiceItem[] = [
  { name: 'ค่าสนาม 1 ชั่วโมง', qty: 1, price: 300 },
  { name: 'เช่าแร็กเก็ต', qty: 2, price: 50, note: 'คืนก่อน 22:00 น.' },
  { name: 'น้ำดื่ม', qty: 1, price: 15 },
]

/** ค่าเริ่มต้นของผู้ซื้อ (fill text — ว่างไว้ให้กรอก) */
const EMPTY_BUYER: TaxInvoiceBuyer = { name: '', address: '', taxId: '' }

/** แถวใบเสร็จจาก /api/shop-receipts (ตาราง ShopReceipt + items) — ใช้ดึงมาออกใบกำกับ */
interface ReceiptRow {
  id: string
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
  items: { id: string; name: string; qty: number; price: number; note?: string | null }[]
}

/**
 * ตั้งค่าใบกำกับภาษีเต็มรูปแบบ (A4) — 2 คอลัมน์ 60/40
 * ซ้าย (60%): ข้อมูลบริษัท/ร้าน (บันทึก DB) + fill text ข้อมูลผู้ซื้อ (ชั่วคราว)
 * ขวา (40%): ตัวอย่างใบกำกับ A4 ที่สะท้อนค่าที่กรอกทันที
 */
export function TaxInvoiceSettings() {
  const [seller, setSeller] = useState<TaxInvoiceSeller>(DEFAULT_TAX_INVOICE_SELLER)
  const [buyer, setBuyer] = useState<TaxInvoiceBuyer>(EMPTY_BUYER)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  /** โหลดข้อมูลผู้ขายที่บันทึกไว้จาก /api/settings (คีย์ tax_invoice_*) */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/settings'), { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const kv = await res.json()
      setSeller(taxInvoiceSellerFromSettings(kv))
    } catch (err) {
      console.error('Failed to fetch tax invoice settings', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** บิลจาก pos-shop (ตาราง ShopReceipt) ที่ดึงมาออกใบกำกับ */
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [receiptLoading, setReceiptLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  /** true = ขยายตัวอย่างเป็นขนาด A4 จริง (เลื่อนดูในคอลัมน์) */
  const [expanded, setExpanded] = useState(false)

  /** โหลดใบเสร็จล่าสุดจาก pos-shop (ผ่าน /api/shop-receipts) */
  const loadReceipts = useCallback(async () => {
    setReceiptLoading(true)
    try {
      const res = await fetch(apiUrl('/api/shop-receipts?limit=100'), { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) {
        setReceipts(data)
        setSelectedId((prev) => prev || data[0]?.id || '')
      }
    } catch (err) {
      console.error('Failed to fetch shop receipts for tax invoice', err)
    } finally {
      setReceiptLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReceipts()
  }, [loadReceipts])

  const selected = receipts.find((r) => r.id === selectedId) ?? null

  /** รายการบนใบกำกับ: ใช้ของบิลที่เลือก · ถ้าไม่มีบิลเลย ใช้รายการตัวอย่าง */
  const items: TaxInvoiceItem[] = selected
    ? selected.items.map((it) => ({ name: it.name, qty: it.qty, price: it.price, note: it.note ?? undefined }))
    : SAMPLE_ITEMS

  /** เลขที่/วันที่ของเอกสาร: ใช้ของบิล · ถ้าไม่มี ใช้ค่าตัวอย่าง (เลขที่แปลง S- → T-) */
  const doc = useMemo(
    () =>
      selected
        ? { no: taxInvoiceNo(selected.code), date: format(new Date(selected.soldAt), 'd MMM yyyy HH:mm'), refNo: selected.code }
        : { no: 'TI-0001', date: format(new Date(), 'd MMM yyyy') },
    [selected]
  )

  const setS = (patch: Partial<TaxInvoiceSeller>) => setSeller((prev) => ({ ...prev, ...patch }))
  const setB = (patch: Partial<TaxInvoiceBuyer>) => setBuyer((prev) => ({ ...prev, ...patch }))

  /** บันทึกข้อมูลผู้ขาย/ร้าน ลง Settings (PUT ทีละ key) */
  const handleSave = async () => {
    setSaving(true)
    try {
      const entries: [string, string][] = [
        [TAX_INVOICE_SELLER_KEYS.company, seller.company.trim()],
        [TAX_INVOICE_SELLER_KEYS.address, seller.address.trim()],
        [TAX_INVOICE_SELLER_KEYS.taxId, seller.taxId.trim()],
        [TAX_INVOICE_SELLER_KEYS.shopName, seller.shopName.trim()],
        [TAX_INVOICE_SELLER_KEYS.posId, seller.posId.trim()],
      ]
      await Promise.all(
        entries.map(([key, value]) =>
          fetch(apiUrl('/api/settings'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          })
        )
      )
      toast.success('บันทึกการตั้งค่าใบกำกับภาษีแล้ว')
    } catch (err) {
      console.error('Failed to save tax invoice settings', err)
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* ซ้าย 60% — ดึงบิลจาก pos-shop + fill text ข้อมูลผู้ซื้อ */}
      <div className="space-y-4">
        {/* ดึง เลขที่บิล + ตารางใบเสร็จ จาก pos-shop */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-emerald-600" /> ดึงข้อมูลจาก pos-shop
              <Badge variant="secondary" className="text-xs">{receipts.length} บิล</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {receiptLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : receipts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีบิลใน pos-shop — ปิดบิลก่อนแล้วกดรีเฟรช</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">เลขที่บิล (จาก pos-shop)</Label>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger aria-label="เลือกเลขที่บิล" className="w-full"><SelectValue placeholder="เลือกเลขที่บิล" /></SelectTrigger>
                    <SelectContent>
                      {receipts.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.code} · {formatTHB(r.total)} · {format(new Date(r.soldAt), 'd MMM yy HH:mm')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selected && (
                  <div className="rounded-lg border">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-2 py-1.5 text-xs">
                      <span className="font-medium">บิล {selected.code}</span>
                      <span className="text-muted-foreground">{format(new Date(selected.soldAt), 'd MMM yyyy HH:mm')} · {selected.method === 'cash' ? 'เงินสด' : 'โอน/QR'}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>รายการ</TableHead>
                          <TableHead className="w-14 text-right">จำนวน</TableHead>
                          <TableHead className="w-20 text-right">ราคา/หน่วย</TableHead>
                          <TableHead className="w-20 text-right">รวม</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.items.map((it, i) => (
                          <TableRow key={it.id}>
                            <TableCell className="text-xs">{i + 1}</TableCell>
                            <TableCell className="whitespace-normal text-xs">
                              {it.name}
                              {it.note && <div className="text-[10px] text-muted-foreground">{it.note}</div>}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{it.qty}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{formatTHB(it.price)}</TableCell>
                            <TableCell className="text-right text-xs font-medium tabular-nums">{formatTHB(it.price * it.qty)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 border-t px-2 py-1.5 text-xs text-muted-foreground">
                      <span>ก่อนลด {formatTHB(selected.subtotal)}</span>
                      {selected.discount > 0 && <span>ส่วนลด {formatTHB(selected.discount)}</span>}
                      <span className="font-semibold text-emerald-700">ยอดสุทธิ {formatTHB(selected.total)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* fill text — ข้อมูลผู้ซื้อ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-emerald-600" /> fill text — ข้อมูลผู้ซื้อ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="ti-cust-name">Customer Name</Label>
              <Input id="ti-cust-name" aria-label="Customer Name" value={buyer.name} onChange={(e) => setB({ name: e.target.value })} placeholder="ชื่อลูกค้า / บริษัทผู้ซื้อ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="ti-cust-address">Customer Address</Label>
              <Textarea id="ti-cust-address" aria-label="Customer Address" value={buyer.address} onChange={(e) => setB({ address: e.target.value })} className="min-h-14 text-sm" placeholder="ที่อยู่ลูกค้า" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="ti-cust-tax">Customer Tax ID</Label>
              <Input id="ti-cust-tax" aria-label="Customer Tax ID" value={buyer.taxId} onChange={(e) => setB({ taxId: e.target.value })} placeholder="0-0000-00000-00-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ขวา 40% — ตัวอย่างใบกำกับ (A4) + ปุ่มดูตัวอย่าง/พิมพ์, ข้อมูลผู้ขายย้ายมาอยู่ใต้ตัวอย่าง */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {/* ตัวอย่าง + ปุ่ม */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-emerald-600" /> ตัวอย่างใบกำกับ (A4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={'overflow-auto rounded-lg bg-slate-100 p-2 ' + (expanded ? 'max-h-[70vh]' : 'max-h-[60vh]')}>
              <TaxInvoiceA4 seller={seller} buyer={buyer} items={items} doc={doc} preview={!expanded} />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <Shrink className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                {expanded ? 'ย่อตัวอย่าง' : 'ดูตัวอย่าง'}
              </Button>
              <Button size="sm" className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={() => window.print()}>
                <Printer className="mr-1 h-3 w-3" /> พิมพ์
              </Button>
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">
              {selected ? `ใช้ข้อมูลจากบิล ${selected.code}` : 'ยังไม่ได้เลือกบิล — แสดงรายการตัวอย่าง'}
            </p>
          </CardContent>
        </Card>

        {/* ข้อมูลผู้ขาย (บริษัท) — ย้ายมาอยู่ใต้ตัวอย่าง (บันทึกถาวร) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Save className="h-4 w-4 text-emerald-600" /> ข้อมูลผู้ขาย (บริษัท) — บันทึกถาวร
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="ti-company">ชื่อบริษัท</Label>
                  <Input id="ti-company" aria-label="ชื่อบริษัท" value={seller.company} onChange={(e) => setS({ company: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="ti-address">ที่อยู่</Label>
                  <Textarea id="ti-address" aria-label="ที่อยู่บริษัท" value={seller.address} onChange={(e) => setS({ address: e.target.value })} className="min-h-14 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="ti-tax-id">เลขประจำตัวผู้เสียภาษี (บริษัท)</Label>
                  <Input id="ti-tax-id" aria-label="เลขผู้เสียภาษีบริษัท" value={seller.taxId} onChange={(e) => setS({ taxId: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor="ti-shop-name">Shop Name</Label>
                    <Input id="ti-shop-name" aria-label="Shop Name" value={seller.shopName} onChange={(e) => setS({ shopName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor="ti-pos-id">POS ID</Label>
                    <Input id="ti-pos-id" aria-label="POS ID" value={seller.posId} onChange={(e) => setS({ posId: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} บันทึก
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={load} disabled={saving || loading}>
                    <RotateCcw className="mr-1 h-3 w-3" /> คืนค่าเดิม
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* สำเนาสำหรับพิมพ์ (A4) — ซ่อนนอกจอ ใช้ตอนกดปุ่ม "พิมพ์" */}
      <TaxInvoicePrintRoot seller={seller} buyer={buyer} items={items} doc={doc} />
    </div>
  )
}
