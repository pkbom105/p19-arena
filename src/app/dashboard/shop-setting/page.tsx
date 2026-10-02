'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, GraduationCap, Loader2, Package, Plus, Search, Tags, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl, BASE_PATH } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { ProductForm } from '@/components/shop-setting/product-form'
import { ProductList } from '@/components/shop-setting/product-list'
import { CategoryDialog } from '@/components/shop-setting/category-dialog'
import { CategoryList } from '@/components/shop-setting/category-list'
import { useShopCategories } from '@/hooks/use-shop-categories'
import type { ShopProductRow } from '@/components/shop-setting/types'
import { EquipmentSection } from '@/components/dashboard/equipment-section'
import type { Equipment } from '@/components/dashboard/types'
import { CoachList, type CoachRow } from '@/components/dashboard/coach-list'

type CategoryFilter = string

/** ส่วนที่แสดงในหน้านี้ (กลุ่มเมนูด้านบน) */
type SectionId = 'products' | 'categories' | 'equipment' | 'coach'

/**
 * ตั้งค่าสินค้าร้าน POS (/dashboard/shop-setting)
 * เพิ่ม / แก้ไข / เปิด-ปิด สินค้าที่ขายในหน้าแคชเชียร์ — เก็บในตาราง ShopProduct ผ่าน /api/shop-products
 * สินค้าที่ "เปิดใช้งาน" จะไปโผล่บนหน้า /dashboard/pos-shop ทันที
 */
export default function ShopSettingPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [products, setProducts] = useState<ShopProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [showInactive, setShowInactive] = useState(true)
  const [editing, setEditing] = useState<ShopProductRow | null>(null)
  const [showNew, setShowNew] = useState(false)

  // หมวดสินค้าจากตาราง ShopCategory (รวมที่ปิดใช้งาน) — เพิ่มหมวดใหม่ได้จากปุ่มในหัวการ์ด
  const { categories, addCategory, reloadCategories } = useShopCategories(true)

  // อุปกรณ์ให้เช่า (ย้ายมาจากหน้า Dashboard → Equipment) — จัดการผ่าน /api/equipment
  const [equipment, setEquipment] = useState<Equipment[]>([])

  // รายชื่อโค้ช — จัดการผ่าน /api/coaches (แก้ไขได้)
  const [coaches, setCoaches] = useState<CoachRow[]>([])

  /** ส่วนที่กำลังแสดง: การ์ดสินค้า หรือ การ์ดหมวด (ผูกกับ ?section=) */
  const [section, setSection] = useState<SectionId>('products')

  // อ่าน ?section= ตอนเปิดหน้า (ทำใน effect เพื่อไม่ให้ hydration ไม่ตรงกัน)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('section')
    if (s === 'products' || s === 'categories' || s === 'equipment' || s === 'coach') setSection(s)
  }, [])

  /** สลับส่วน + sync URL โดยไม่โหลดหน้าใหม่ (แบบเดียวกับหน้า /dashboard) */
  const goSection = (next: SectionId) => {
    setSection(next)
    window.history.pushState(null, '', `${BASE_PATH}/dashboard/shop-setting?section=${next}`)
  }

  /** โหลดสินค้าทั้งหมด (รวมที่ปิดใช้งาน) */
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
      setLoadError('โหลดรายการสินค้าไม่สำเร็จ — ถ้าเพิ่งเพิ่มตารางใหม่ในฐานข้อมูล ต้อง restart server หนึ่งครั้งก่อน')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  /** โหลดอุปกรณ์ให้เช่า — ย้ายมาจากหน้า Dashboard → Equipment */
  const loadEquipment = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/equipment?all=1'))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) setEquipment(data)
    } catch (err) {
      console.error('Failed to fetch equipment', err)
    }
  }, [])

  useEffect(() => {
    loadEquipment()
  }, [loadEquipment])

  /** โหลดรายชื่อโค้ช — ผ่าน /api/coaches */
  const loadCoaches = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/coaches?all=1'))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) setCoaches(data)
    } catch (err) {
      console.error('Failed to fetch coaches', err)
    }
  }, [])

  useEffect(() => {
    loadCoaches()
  }, [loadCoaches])

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
      await loadProducts()
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
      await loadProducts()
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
      await loadProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
      throw err
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <PosHeader date={todayStr} refreshing={loading} title="shop-setting" onRefresh={loadProducts} />
      <PosMobileNav active="shop-setting" />

      <div className="flex flex-1">
        <PosSidebar active="shop-setting" />

        <main className="min-w-0 flex-1 space-y-4 px-4 py-5 lg:pl-4">
          {loadError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* กลุ่มเมนูด้านบน — สลับส่วนระหว่างการ์ดสินค้า กับ การ์ดหมวด (ผูกกับ ?section=) */}
          <Tabs value={section} onValueChange={(v) => goSection(v as SectionId)} className="w-full">
            {/* เมนูกลุ่มสไตล์ปุ่มเขียว — สูงเป็น 2 เท่าของแท็บมาตรฐาน (36px → 72px) */}
            <TabsList className="h-auto w-full flex-wrap gap-2 rounded-none bg-transparent p-0 sm:w-fit">
              <TabsTrigger
                value="products"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <Package className="h-4 w-4" /> สินค้าในร้าน (POS)
              </TabsTrigger>
              <TabsTrigger
                value="categories"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <Tags className="h-4 w-4" /> หมวดสินค้า (POS)
              </TabsTrigger>
              <TabsTrigger
                value="equipment"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <Wrench className="h-4 w-4" /> อุปกรณ์เช่า
              </TabsTrigger>
              <TabsTrigger
                value="coach"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <GraduationCap className="h-4 w-4" /> โค้ช
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
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
            </TabsContent>

            {/* การ์ดจัดการหมวดสินค้า — เข้าจากกลุ่มเมนูด้านบน (แท็บ "หมวดสินค้า (POS)") */}
            <TabsContent value="categories" className="space-y-4">
              <CategoryList categories={categories} onUpdated={reloadCategories} />
            </TabsContent>

            {/* การ์ดจัดการอุปกรณ์ให้เช่า — ย้ายมาจากหน้า Dashboard → Equipment */}
            <TabsContent value="equipment" className="space-y-4">
              <EquipmentSection equipment={equipment} onChanged={loadEquipment} />
            </TabsContent>

            {/* รายชื่อโค้ช — UI แบบเดียวกับอุปกรณ์เช่า + วันที่/เวลาว่าง (แก้ไขได้) */}
            <TabsContent value="coach" className="space-y-4">
              <CoachList coaches={coaches} onChanged={loadCoaches} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
