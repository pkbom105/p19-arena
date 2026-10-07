'use client'

import { useMemo } from 'react'
import { BarChart3, ClipboardList, PackageOpen, Tags, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTHB } from '@/components/pos-shop/catalog'
import type { ShopCategoryRow } from '@/components/pos-shop/types'
import type { ShopProductRow } from '@/components/shop-setting/types'
import { StatCard } from './stat-card'

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

/**
 * sub-menu "dashboard รวม report" ของหน้า /dashboard/shop/shop-report
 * ภาพรวมทั้งร้าน (สินค้า/หมวด/ช่วงราคา) + สรุปแยกรายหมวด + สินค้าราคาสูงสุด
 * ข้อมูลรับมาจาก page (โหลดจาก /api/shop-products?all=1 + useShopCategories)
 */
export function OverviewSection({ products, categories, loading }: {
  products: ShopProductRow[]
  categories: ShopCategoryRow[]
  loading: boolean
}) {
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
    <>
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
    </>
  )
}
