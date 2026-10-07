'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Search, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ShopCategory } from '@/components/pos-shop/types'
import { CategoryDialog } from './category-dialog'
import { ProductForm } from './product-form'
import { ProductList } from './product-list'
import type { ShopProductRow } from './types'

type CategoryFilter = string

/**
 * sub-menu "สินค้าในร้าน (POS)" ของหน้า /dashboard/shop-setting
 * ตัวกรอง/ค้นหา + เพิ่ม–แก้ไข–เปิดปิด–ลบสินค้า (บันทึกผ่าน /api/shop-products)
 * รายการสินค้ารับมาจาก page (ใช้ร่วมกับปุ่มรีเฟรช) แล้วเรียก onChanged() เพื่อโหลดใหม่หลังบันทึก
 */
export function ProductsSection({ products, loading, categories, addCategory, onChanged }: {
  products: ShopProductRow[]
  loading: boolean
  categories: ShopCategory[]
  addCategory: (category: ShopCategory) => void
  onChanged: () => void | Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [showInactive, setShowInactive] = useState(true)
  const [editing, setEditing] = useState<ShopProductRow | null>(null)
  const [showNew, setShowNew] = useState(false)

  // ตัวกรอง: หมวด + คำค้นหา + จะแสดงรายการที่ปิดใช้งานหรือไม่
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => showInactive || p.isActive)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.nameEn || '').toLowerCase().includes(q))
  }, [products, category, search, showInactive])

  const activeCount = products.filter((p) => p.isActive).length

  const handleSave = async (data: Partial<ShopProductRow>) => {
    setSaving(true)
    const isEdit = Boolean(data.id)
    try {
      const res = await fetch(apiUrl('/api/shop-products'), {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: data.id } : {}),
          name: data.name,
          nameEn: data.nameEn,
          category: data.category,
          price: data.price,
          stockStart: data.stockStart,
          costPrice: data.costPrice,
          unit: data.unit,
          emoji: data.emoji,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ')
      toast.success(isEdit ? `บันทึกการแก้ไข "${data.name}" แล้ว` : `เพิ่มสินค้า "${data.name}" แล้ว`)
      setEditing(null)
      setShowNew(false)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (p: ShopProductRow) => {
    try {
      const res = await fetch(apiUrl('/api/shop-products'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
      })
      if (!res.ok) throw new Error('อัปเดตสถานะไม่สำเร็จ')
      toast.success(p.isActive ? `ปิดใช้งาน "${p.name}" แล้ว` : `เปิดใช้งาน "${p.name}" แล้ว`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ')
    }
  }

  /** ลบถาวร (เฉพาะสินค้าที่ปิดใช้งานแล้ว) — ลบแถวจริงออกจากฐานข้อมูล กู้คืนไม่ได้ */
  const handleDeletePermanent = async (p: ShopProductRow) => {
    try {
      const res = await fetch(apiUrl(`/api/shop-products?id=${encodeURIComponent(p.id)}&hard=1`), { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'ลบไม่สำเร็จ')
      toast.success(`ลบสินค้า "${p.name}" ออกจากฐานข้อมูลแล้ว`)
      if (editing?.id === p.id) setEditing(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
      throw err
    }
  }

  return (
    <>
<Card>
  <CardHeader className="pb-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-base">
        <Tags className="h-4 w-4 text-emerald-600" /> สินค้าในร้าน (POS)
        <Badge variant="secondary" className="text-xs">
          เปิดใช้งาน {activeCount} / ทั้งหมด {products.length}
        </Badge>
      </CardTitle>
      {/* ปุ่มเพิ่มหมวด — วางทางซ้ายของปุ่ม "+ เพิ่มสินค้า" (ตัวกรองหมวดอยู่ที่แท็บด้านล่าง) */}
      <div className="flex flex-wrap items-center gap-2">
        <CategoryDialog onCreated={addCategory} />
        <Button
          size="sm"
          className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700"
          onClick={() => { setEditing(null); setShowNew(true) }}
        >
          <Plus className="mr-1 h-3 w-3" /> เพิ่มสินค้า
        </Button>
      </div>
    </div>
  </CardHeader>

  <CardContent className="space-y-3">
    {/* ฟอร์มเพิ่มสินค้าใหม่ — ส่วนแก้ไขใช้ Collapsible ในแถวของ ProductList แทน */}
    {showNew && (
      <ProductForm
        initial={{}}
        saving={saving}
        categories={categories}
        onSave={handleSave}
        onCancel={() => setShowNew(false)}
      />
    )}

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all" className="gap-1.5">🛒 ทั้งหมด</TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
              {c.emoji} {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative sm:w-56">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="ค้นหาสินค้าในหน้าตั้งค่า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาสินค้า…"
          className="pl-8"
        />
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Checkbox
        id="show-inactive"
        aria-label="แสดงรายการที่ปิดใช้งาน"
        checked={showInactive}
        onCheckedChange={(v) => setShowInactive(v === true)}
      />
      <Label htmlFor="show-inactive" className="text-xs text-muted-foreground">
        แสดงรายการที่ปิดใช้งานด้วย
      </Label>
    </div>

    {loading ? (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    ) : (
      <ProductList
        products={visible}
        categories={categories}
        editingId={editing?.id ?? null}
        saving={saving}
        onDeletePermanent={handleDeletePermanent}
        onEdit={(p) => { setShowNew(false); setEditing(p) }}
        onCancelEdit={() => setEditing(null)}
        onSave={handleSave}
        onToggleActive={handleToggleActive}
      />
    )}
  </CardContent>
</Card>

<p className="text-[11px] text-muted-foreground">
  สินค้าที่ &quot;เปิดใช้งาน&quot; จะแสดงบนหน้าแคชเชียร์ทันที · ปิดใช้งาน = ซ่อนจากหน้าแคชเชียร์ (ไม่ลบข้อมูล)
</p>
    </>
  )
}
