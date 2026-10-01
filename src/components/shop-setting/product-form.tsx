'use client'

import { useState } from 'react'
import { Eye, Loader2, Package, Save, ShoppingBag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SHOP_CATEGORIES } from '@/components/pos-shop/catalog'
import type { ShopCategory } from '@/components/pos-shop/types'
import type { ShopProductRow } from './types'

interface ProductFormProps {
  initial: Partial<ShopProductRow>
  onSave: (data: Partial<ShopProductRow>) => void
  onCancel: () => void
  saving: boolean
  /** หมวดที่ใช้เลือกได้ — ส่งจากหน้าแม่ (มีค่าสำรองเป็นหมวดเริ่มต้นในโค้ด) */
  categories?: ShopCategory[]
}

/** ฟอร์มเพิ่ม/แก้ไขสินค้า — ใช้ในหน้า /dashboard/shop-setting */
export function ProductForm({ initial, onSave, onCancel, saving, categories = SHOP_CATEGORIES }: ProductFormProps) {
  const [form, setForm] = useState({
    name: initial.name || '',
    nameEn: initial.nameEn || '',
    category: initial.category || 'cloth',
    price: initial.price ?? 0,
    stockStart: initial.stockStart ?? 0,
    costPrice: initial.costPrice ?? 0,
    unit: initial.unit || 'ชิ้น',
    emoji: initial.emoji || '',
    barcode: initial.barcode || '',
    sortOrder: initial.sortOrder ?? 0,
    isActive: initial.isActive ?? true,
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  /** จำนวนขายจริงจากบิลขาย (เซิร์ฟเวอร์คำนวณ — แก้ไม่ได้) */
  const soldQty = initial.soldQty ?? 0
  /** กำไรต่อหน่วย = ราคาขาย − ราคาทุน */
  const profitPerUnit = form.price - form.costPrice
  /** คงเหลือ = จำนวนเริ่มต้น − จำนวนขายจริง (ติดลบได้ = ขายเกินสต็อกตั้งต้น) */
  const stockLeft = form.stockStart - soldQty

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      {/* ── กลุ่ม 1: ข้อมูลพื้นฐานของสินค้า ── */}
      <section data-slot="form-group" className="space-y-2">
        <div data-slot="form-group-title" className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5" /> ข้อมูลสินค้า
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="shop-name">ชื่อสินค้า (ไทย) *</Label>
            <Input
              id="shop-name"
              aria-label="ชื่อสินค้า (ไทย)"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="เสื้อยืด P19"
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="shop-name-en">ชื่อสินค้า (อังกฤษ)</Label>
            <Input
              id="shop-name-en"
              aria-label="ชื่อสินค้า (อังกฤษ)"
              value={form.nameEn}
              onChange={(e) => set('nameEn', e.target.value)}
              placeholder="P19 T-Shirt"
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="shop-barcode">บาร์โค้ด</Label>
            <Input
              id="shop-barcode"
              aria-label="บาร์โค้ด"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              placeholder="8851234567890 (เว้นว่างได้)"
              className="h-8 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">หมวดสินค้า</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v as ShopProductRow['category'])}>
              <SelectTrigger className="h-8 text-sm" aria-label="หมวดสินค้า">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">หน่วยนับ</Label>
            <Input
              aria-label="หน่วยนับ"
              value={form.unit}
              onChange={(e) => set('unit', e.target.value)}
              placeholder="ตัว / อัน / ขวด"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ไอคอน (emoji)</Label>
            <Input
              aria-label="ไอคอน"
              value={form.emoji}
              onChange={(e) => set('emoji', e.target.value)}
              placeholder="👕"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ลำดับการแสดง</Label>
            <Input
              aria-label="ลำดับ"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', parseInt(e.target.value) || 0)}
              className="h-8 text-sm tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* ── กลุ่ม 2: ราคา & สต็อก (คำนวณจากราคาขายและบิลขายจริง) ── */}
      <section data-slot="form-group" className="space-y-2 border-t pt-3">
        <div data-slot="form-group-title" className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Package className="h-3.5 w-3.5" /> ราคา & สต็อก
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ราคาขาย (บาท)</Label>
            <Input
              aria-label="ราคาขาย"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set('price', parseInt(e.target.value) || 0)}
              className="h-8 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="shop-cost">ราคาทุน (บาท)</Label>
            <Input
              id="shop-cost"
              aria-label="ราคาทุน"
              type="number"
              value={form.costPrice}
              onChange={(e) => set('costPrice', parseInt(e.target.value) || 0)}
              className="h-8 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="shop-stock-start">จำนวนเริ่มต้น</Label>
            <Input
              id="shop-stock-start"
              aria-label="จำนวนเริ่มต้น"
              type="number"
              value={form.stockStart}
              onChange={(e) => set('stockStart', parseInt(e.target.value) || 0)}
              className="h-8 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="shop-sold">จำนวนขาย (จากบิลขายจริง)</Label>
            <Input
              id="shop-sold"
              aria-label="จำนวนขาย"
              readOnly
              value={soldQty}
              className="h-8 bg-muted/40 text-sm tabular-nums"
            />
          </div>
          {/* สรุปที่ระบบคำนวณให้ — แก้ไม่ได้ (คิดจากราคาขายและบิลขายจริง) */}
          <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">กำไรต่อหน่วย</span>
              <span data-slot="profit-unit" className={'font-semibold tabular-nums ' + (profitPerUnit < 0 ? 'text-destructive' : 'text-foreground')}>
                ฿<span data-slot="profit-unit-value">{profitPerUnit}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">คงเหลือ</span>
              <span data-slot="stock-left" className={'font-semibold tabular-nums ' + (stockLeft < 0 ? 'text-destructive' : 'text-foreground')}>
                <span data-slot="stock-left-value">{stockLeft}</span> ชิ้น
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── กลุ่ม 3: การแสดงผลในหน้าร้าน ── */}
      <section data-slot="form-group" className="space-y-2 border-t pt-3">
        <div data-slot="form-group-title" className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> การแสดงผลในร้าน
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="shop-active"
            aria-label="เปิดใช้งาน"
            checked={form.isActive}
            onCheckedChange={(v) => set('isActive', v === true)}
            className="data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
          />
          <Label htmlFor="shop-active" className={'text-xs ' + (form.isActive ? 'text-amber-800' : 'text-muted-foreground')}>
            เปิดใช้งาน (แสดงในหน้าแคชเชียร์)
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          size="sm"
          className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700"
          onClick={() => onSave({ ...initial, ...form })}
          disabled={saving || !form.name.trim()}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          บันทึก
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          <X className="mr-1 h-3 w-3" /> ยกเลิก
        </Button>
      </div>
    </div>
  )
}
