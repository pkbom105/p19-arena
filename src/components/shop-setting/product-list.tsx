'use client'

import { ChevronDown, Pencil, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SHOP_CATEGORIES, formatTHB } from '@/components/pos-shop/catalog'
import type { ShopCategory } from '@/components/pos-shop/types'
import { ProductForm } from './product-form'
import { PermanentDeleteButton } from './permanent-delete-button'
import type { ShopProductRow } from './types'

/** หาชื่อหมวดจากรายการที่โหลดมา — หมวดใหม่จะแสดงชื่อได้ (ไม่ใช่รหัสดิบ) */
const categoryLabel = (id: string, categories: ShopCategory[]) => {
  const c = categories.find((x) => x.id === id)
  return c ? `${c.emoji} ${c.label}` : id
}

/** ลิสต์สินค้า — ปุ่ม "แก้ไข" กางฟอร์มแบบ Collapsible (shadcn) ใต้แถวนั้นแถวเดียว + ปุ่มเปิด-ปิดใช้งาน / ลบถาวร */
export function ProductList({ products, categories = SHOP_CATEGORIES, editingId = null, saving = false, onEdit, onCancelEdit, onSave, onToggleActive, onDeletePermanent }: {
  products: ShopProductRow[]
  categories?: ShopCategory[]
  /** id ของสินค้าที่กำลังแก้ไข (null = ไม่มีแถวไหนกาง) — คุมการเปิด/ปิดของ Collapsible */
  editingId?: string | null
  saving?: boolean
  onEdit: (p: ShopProductRow) => void
  /** กด "ยกเลิก" หรือพับแถว → ล้างสถานะแก้ไขที่หน้าแม่ */
  onCancelEdit: () => void
  /** กด "บันทึก" ในฟอร์มที่กางอยู่ในแถว */
  onSave: (data: Partial<ShopProductRow>) => void
  onToggleActive: (p: ShopProductRow) => void
  /** ลบแถวจริงออกจากฐานข้อมูล — ถ้าไม่ส่งมา ปุ่มลบถาวรจะไม่แสดง */
  onDeletePermanent?: (p: ShopProductRow) => void | Promise<void>
}) {
  if (products.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
  }

  return (
    <div className="space-y-2">
      {products.map((p) => {
        const open = editingId === p.id
        return (
        <Collapsible
          key={p.id}
          open={open}
          onOpenChange={(next) => (next ? onEdit(p) : onCancelEdit())}
          className={`rounded-lg border ${p.isActive ? 'bg-muted/20' : 'bg-muted/40 opacity-70'}`}
        >
          <div data-slot="product-row" className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2">
          <span className="shrink-0 text-xl leading-none">{p.emoji || '🛍️'}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {p.nameEn || '—'} · {categoryLabel(p.category, categories)}
            </div>
          </div>
          <div className="shrink-0 text-right text-sm font-semibold text-emerald-700">
            {formatTHB(p.price)}
            <span className="block text-[10px] font-normal text-muted-foreground">/ {p.unit} · ลำดับ {p.sortOrder}</span>
          </div>
          {/* สต็อก/กำไร — จำนวนขายคิดจากบิลขายจริง (คงเหลือติดลบได้ = ขายเกินสต็อกตั้งต้น) */}
          <div className="shrink-0 text-right text-[10px] leading-tight">
            <div className="text-muted-foreground">
              คงเหลือ{' '}
              <span className={'font-semibold ' + ((p.stockLeft ?? 0) < 0 ? 'text-destructive' : 'text-foreground')}>
                {p.stockLeft ?? 0}
              </span>{' '}
              {p.unit}
            </div>
            <div className="text-muted-foreground">
              กำไร/หน่วย{' '}
              <span className={'font-semibold ' + (p.price - (p.costPrice ?? 0) < 0 ? 'text-destructive' : 'text-emerald-700')}>
                {formatTHB(p.price - (p.costPrice ?? 0))}
              </span>
            </div>
          </div>
          <Badge
            variant={p.isActive ? 'secondary' : 'outline'}
            className={'shrink-0 text-[10px] ' + (p.isActive ? 'border-amber-300 bg-amber-100 text-amber-800' : '')}
          >
            {p.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
          </Badge>
          <div className="flex shrink-0 items-center gap-1">
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                aria-label={`แก้ไข ${p.name}`}
              >
                <Pencil className="mr-1 h-3 w-3" /> แก้ไข
                <ChevronDown className={'ml-1 h-3 w-3 transition-transform ' + (open ? 'rotate-180' : '')} />
              </Button>
            </CollapsibleTrigger>
            <Button
              variant={p.isActive ? 'ghost' : 'outline'}
              size="sm"
              className={`h-7 text-xs ${p.isActive ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-emerald-700'}`}
              aria-label={`${p.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} ${p.name}`}
              onClick={() => onToggleActive(p)}
            >
              <Power className="mr-1 h-3 w-3" /> {p.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            </Button>
            {onDeletePermanent && (
              <PermanentDeleteButton kind="สินค้า" label={p.name} onConfirm={() => onDeletePermanent(p)} />
            )}
          </div>
          </div>

          {/* ฟอร์มแก้ไขกางออกใต้แถวนี้เท่านั้น (Collapsible ของ shadcn) */}
          <CollapsibleContent className="px-2 pb-2">
            <ProductForm initial={p} saving={saving} categories={categories} onSave={onSave} onCancel={onCancelEdit} />
          </CollapsibleContent>
        </Collapsible>
        )
      })}
    </div>
  )
}
