'use client'

import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTHB } from './catalog'
import type { ShopCategory, ShopCategoryId, ShopProduct } from './types'

export type ShopCategoryFilter = ShopCategoryId | 'all'

/** แท็บหมวด + ค้นหา + การ์ดสินค้า (กดการ์ด = เพิ่มลงตะกร้า) */
export function ProductGrid({ products, categories, category, onCategory, search, onSearch, onAdd }: {
  products: ShopProduct[]
  /** หมวดที่โหลดจาก /api/shop-categories — ส่งมาจากหน้าแม่ */
  categories: ShopCategory[]
  category: ShopCategoryFilter
  onCategory: (c: ShopCategoryFilter) => void
  search: string
  onSearch: (v: string) => void
  onAdd: (p: ShopProduct) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={category} onValueChange={(v) => onCategory(v as ShopCategoryFilter)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all" className="gap-1.5">🛒 ทั้งหมด</TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
                {c.emoji} {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="ค้นหาสินค้า…"
            className="pl-8"
            aria-label="ค้นหาสินค้า"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border bg-white py-10 text-center text-sm text-muted-foreground">
          ไม่พบสินค้าที่ตรงกับเงื่อนไข
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAdd(p)}
              className="flex flex-col gap-1 rounded-xl border bg-white p-3 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
            >
              <span className="text-2xl leading-none">{p.emoji}</span>
              <span className="text-sm font-medium leading-snug">{p.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{p.nameEn}</span>
              <span className="mt-1 flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-emerald-700">{formatTHB(p.price)}</span>
                <Badge variant="secondary" className="text-[10px]">+ เพิ่ม</Badge>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
