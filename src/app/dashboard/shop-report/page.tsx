'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, BarChart3, ClipboardList, Eye, PackageOpen, Printer, Receipt, Search, Tags, TrendingUp } from 'lucide-react'
import { apiUrl, BASE_PATH } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { ReceiptDialog } from '@/components/pos-shop/receipt-dialog'
import { useShopCategories } from '@/hooks/use-shop-categories'
import { formatTHB } from '@/components/pos-shop/catalog'
import type { ShopBill } from '@/components/pos-shop/types'
import type { ShopProductRow } from '@/components/shop-setting/types'

/**
 * รายงานร้านค้า (/dashboard/shop-report) — หน้าดูอย่างเดียว (แก้ไขที่ /dashboard/shop-setting)
 * กลุ่มเมนู 2 ส่วน (ผูกกับ ?section=): "dashboard รวม report" (สินค้า/หมวด) และ "ใบเสร็จ จาก pos-shop" (ยอดขาย + ตารางบิล)
 * ข้อมูลจาก /api/shop-products?all=1 · /api/shop-categories?all=1 · /api/shop-receipts
 */

/** ส่วนที่แสดงในหน้านี้ (กลุ่มเมนูด้านบน) */
type SectionId = 'overview' | 'receipts'

/** ช่วงเวลาของตารางใบเสร็จ */
type ReceiptRange = 'today' | '7d' | 'all'

/** ป้ายชื่อช่วงเวลาของตัวกรองใบเสร็จ */
const RECEIPT_RANGE_LABEL: Record<ReceiptRange, string> = { today: 'วันนี้', '7d': '7 วัน', all: 'ทั้งหมด' }

/** รายการสินค้าในใบเสร็จ 1 ใบ */
interface ShopReceiptItemRow {
  id: string
  name: string
  qty: number
  price: number
}

/** ใบเสร็จที่บันทึกในตาราง ShopReceipt */
interface ShopReceiptRow {
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

/** แถวสรุปต่อหมวดสินค้า */
interface CategorySummary {
  id: string
  label: string
  labelEn: string
  emoji: string
  isActive: boolean
  total: number
  active: number
  minPrice: number
  maxPrice: number
  sumPrice: number
}

/** สรุปช่วงราคา/ยอดรวมของสินค้าที่เปิดใช้งาน */
function summarize(products: ShopProductRow[]) {
  const active = products.filter((p) => p.isActive)
  const prices = active.map((p) => Number(p.price) || 0)
  return {
    total: products.length,
    active: active.length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    sumPrice: prices.reduce((acc, p) => acc + p, 0),
  }
}

export default function ShopReportPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [products, setProducts] = useState<ShopProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [receipts, setReceipts] = useState<ShopReceiptRow[]>([])
  const [receiptLoading, setReceiptLoading] = useState(true)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [receiptRange, setReceiptRange] = useState<ReceiptRange>('today')
  const [receiptSearch, setReceiptSearch] = useState('')
  /** บิลที่กำลังเปิดใบเสร็จ A5 (ดู/พิมพ์) + true = สั่งพิมพ์อัตโนมัติ */
  const [receiptBill, setReceiptBill] = useState<ShopBill | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)

  // รวมหมวดที่ปิดใช้งานด้วย เพื่อให้ยอดรวมตรงกับสินค้าที่อ้างหมวดนั้นอยู่
  const { categories } = useShopCategories(true)

  /** ส่วนที่กำลังแสดง: dashboard รวม report หรือ ตารางใบเสร็จ (ผูกกับ ?section=) */
  const [section, setSection] = useState<SectionId>('overview')

  // อ่าน ?section= ตอนเปิดหน้า (ทำใน effect เพื่อไม่ให้ hydration ไม่ตรงกัน)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('section')
    if (s === 'overview' || s === 'receipts') setSection(s)
  }, [])

  /** สลับส่วน + sync URL โดยไม่โหลดหน้าใหม่ (แบบเดียวกับหน้า /dashboard/shop-setting) */
  const goSection = (next: SectionId) => {
    setSection(next)
    window.history.pushState(null, '', `${BASE_PATH}/dashboard/shop-report?section=${next}`)
  }

  /** โหลดสินค้าทั้งหมด (รวมที่ปิดใช้งาน) — ใช้ตัวเดียวกับหน้าตั้งค่า */
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/shop-products?all=1'))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) {
        setProducts(data)
        setLoadError(null)
      }
    } catch (err) {
      console.error('Failed to fetch shop products', err)
      setLoadError('โหลดข้อมูลสินค้าไม่สำเร็จ — กดปุ่มรีเฟรชมุมขวาบนอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  /** โหลดใบเสร็จล่าสุดจากตาราง ShopReceipt (บันทึกจากหน้าแคชเชียร์ pos-shop) */
  const loadReceipts = useCallback(async () => {
    setReceiptLoading(true)
    try {
      const res = await fetch(apiUrl('/api/shop-receipts?limit=100'))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) {
        setReceipts(data)
        setReceiptError(null)
      }
    } catch (err) {
      console.error('Failed to fetch shop receipts', err)
      setReceiptError('โหลดใบเสร็จไม่สำเร็จ — ถ้าเพิ่งเพิ่มตารางใหม่ในฐานข้อมูล ต้อง restart server หนึ่งครั้งก่อน')
    } finally {
      setReceiptLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReceipts()
  }, [loadReceipts])

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
      items: row.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      method: row.method === 'transfer' ? 'transfer' : 'cash',
      received: row.received,
      change: row.change,
      at: row.soldAt,
    })
  }

  /** ภาพรวมทั้งร้าน */
  const stats = useMemo(() => {
    const all = summarize(products)
    const activeCats = categories.filter((c) => c.isActive).length
    return {
      ...all,
      inactive: all.total - all.active,
      inactiveSum: summarize(products.filter((p) => !p.isActive)).sumPrice,
      totalCats: categories.length,
      activeCats,
      avg: all.active ? all.sumPrice / all.active : 0,
    }
  }, [products, categories])

  /** สรุปแยกรายหมวด (เรียงตาม sortOrder ของหมวด) + หมวดที่ถูกลบไปแล้วแต่สินค้ายังอ้างอยู่ */
  const byCategory = useMemo<CategorySummary[]>(() => {
    const groups = new Map<string, ShopProductRow[]>()
    for (const p of products) {
      const list = groups.get(p.category) || []
      list.push(p)
      groups.set(p.category, list)
    }

    const rows: CategorySummary[] = categories.map((c) => {
      const list = groups.get(c.id) || []
      groups.delete(c.id)
      return { id: c.id, label: c.label, labelEn: c.labelEn, emoji: c.emoji, isActive: c.isActive, ...summarize(list) }
    })

    for (const [id, list] of groups) {
      rows.push({ id, label: id, labelEn: '(ไม่พบหมวดนี้ในตาราง)', emoji: '❓', isActive: false, ...summarize(list) })
    }

    return rows
  }, [products, categories])

  /** สินค้าที่เปิดใช้งานราคาสูงสุด 5 อันดับ */
  const topPriced = useMemo(
    () =>
      products
        .filter((p) => p.isActive)
        .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
        .slice(0, 5),
    [products]
  )

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <PosHeader
        date={todayStr}
        refreshing={loading || receiptLoading}
        title="shop-report"
        onRefresh={() => {
          loadProducts()
          loadReceipts()
        }}
      />
      <PosMobileNav active="shop-report" />

      <div className="flex flex-1">
        <PosSidebar active="shop-report" />

        <main className="min-w-0 flex-1 space-y-4 px-4 py-5 lg:pl-4">
          {loadError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* กลุ่มเมนูด้านบน — สลับส่วนระหว่าง dashboard รวม report กับ ตารางใบเสร็จ (ผูกกับ ?section=) */}
          <Tabs value={section} onValueChange={(v) => goSection(v as SectionId)} className="w-full">
            <TabsList className="h-auto w-full flex-wrap gap-2 rounded-none bg-transparent p-0 sm:w-fit">
              <TabsTrigger
                value="overview"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <BarChart3 className="h-4 w-4" /> dashboard รวม report
              </TabsTrigger>
              <TabsTrigger
                value="receipts"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <Receipt className="h-4 w-4" /> ใบเสร็จ จาก pos-shop
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
          {loading && products.length === 0 && (
            <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground">กำลังโหลดข้อมูลรายงาน…</div>
          )}

          {/* การ์ดสรุปภาพรวมทั้งร้าน */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<PackageOpen className="h-4 w-4" />}
              label="สินค้าทั้งหมด"
              value={`${stats.total}`}
              sub={`เปิดใช้งาน ${stats.active} · ปิดใช้งาน ${stats.inactive}`}
            />
            <StatCard
              icon={<Tags className="h-4 w-4" />}
              label="หมวดสินค้า"
              value={`${stats.totalCats}`}
              sub={`เปิดใช้งาน ${stats.activeCats} · ปิดใช้งาน ${stats.totalCats - stats.activeCats}`}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="มูลค่าสินค้าที่เปิดใช้งาน"
              value={formatTHB(stats.sumPrice)}
              sub={`เฉลี่ย ${formatTHB(stats.avg)} / รายการ`}
            />
            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="ช่วงราคาที่ขาย"
              value={`${formatTHB(stats.minPrice)} – ${formatTHB(stats.maxPrice)}`}
              sub={`ปิดใช้งานอยู่ ${formatTHB(stats.inactiveSum)}`}
            />
          </div>

          {/* สรุปแยกรายหมวด */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-emerald-600" /> สรุปตามหมวดสินค้า
                <Badge variant="secondary" className="text-xs">{byCategory.length} หมวด</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table className="min-w-[680px] table-fixed">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[36%]">หมวดสินค้า</TableHead>
                    <TableHead className="w-[12%] text-right">สินค้าทั้งหมด</TableHead>
                    <TableHead className="w-[12%] text-right">เปิดใช้งาน</TableHead>
                    <TableHead className="w-[20%] text-right">ช่วงราคา</TableHead>
                    <TableHead className="w-[20%] text-right">รวมราคาสินค้า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-lg">{row.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{row.label}</span>
                              {!row.isActive && <Badge variant="secondary" className="text-[10px]">ปิดใช้งาน</Badge>}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground" title={`${row.labelEn} · ${row.id}`}>
                              {row.labelEn} · {row.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-700 tabular-nums">{row.active}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total ? `${formatTHB(row.minPrice)}–${formatTHB(row.maxPrice)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatTHB(row.sumPrice)}</TableCell>
                    </TableRow>
                  ))}
                  {byCategory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">ยังไม่มีหมวดสินค้า</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="pt-2 text-[11px] text-muted-foreground">รวมราคาสินค้าคำนวณจากราคาขายของสินค้าที่เปิดใช้งาน ไม่รวมจำนวนสต็อก</p>
            </CardContent>
          </Card>

          {/* สินค้าราคาสูงสุด */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-emerald-600" /> สินค้าราคาสูงสุด 5 อันดับ (เปิดใช้งาน)
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {topPriced.map((p, index) => {
                const cat = byCategory.find((c) => c.id === p.category)
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                        {index + 1}
                      </span>
                      <span className="text-lg">{p.emoji || '•'}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {cat ? `${cat.emoji} ${cat.label}` : p.category} · {p.unit}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-600">{formatTHB(Number(p.price) || 0)}</span>
                  </div>
                )
              })}
              {topPriced.length === 0 && <p className="py-3 text-sm text-muted-foreground">ยังไม่มีสินค้าที่เปิดใช้งาน</p>}
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            หมายเหตุ: ส่วนนี้อ่านข้อมูลจริงจากตาราง ShopProduct / ShopCategory — เพิ่ม/แก้ไขสินค้าและหมวดได้ที่ /dashboard/shop-setting
          </p>
            </TabsContent>

            <TabsContent value="receipts" className="space-y-4">
              {receiptError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{receiptError}</span>
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
                  <Table className="min-w-[1120px] table-fixed">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[14%]">วันที่ / เลขที่บิล</TableHead>
                        <TableHead className="w-[25%]">รายการสินค้า</TableHead>
                        <TableHead className="w-[10%]">ชำระโดย</TableHead>
                        <TableHead className="w-[11%] text-right">ก่อนลด</TableHead>
                        <TableHead className="w-[10%] text-right">ส่วนลด</TableHead>
                        <TableHead className="w-[11%] text-right">ยอดสุทธิ</TableHead>
                        <TableHead className="w-[12%] text-right">รับ / ทอน</TableHead>
                        <TableHead className="w-[7%] text-center">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleReceipts.map((r) => {
                        const itemNames = r.items.map((i) => `${i.name} × ${i.qty}`).join(', ')
                        return (
                          <TableRow key={r.id} data-slot="receipt-row">
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
                            <TableCell>
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openReceipt(r)}
                                  aria-label={`ดูใบเสร็จ ${r.code}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openReceipt(r, true)}
                                  aria-label={`พิมพ์ใบเสร็จ ${r.code}`}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {receiptLoading && receipts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">กำลังโหลดใบเสร็จ…</TableCell>
                        </TableRow>
                      )}
                      {!receiptLoading && visibleReceipts.length === 0 && (
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
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

/** การ์ดตัวเลขสรุป (บนสุดของหน้า) */
function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="text-emerald-600">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}


