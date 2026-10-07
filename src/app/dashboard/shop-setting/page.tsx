'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, GraduationCap, Package, Receipt, Tags, Wrench } from 'lucide-react'
import { apiUrl, BASE_PATH } from '@/lib/api'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useShopCategories } from '@/hooks/use-shop-categories'
import type { ShopProductRow } from '@/components/shop-setting/types'
import type { Equipment } from '@/components/dashboard/types'
import { EquipmentSection } from '@/components/dashboard/equipment-section'
import { CoachList, type CoachRow } from '@/components/dashboard/coach-list'
import { ProductsSection } from '@/components/shop-setting/products-section'
import { CategoriesSection } from '@/components/shop-setting/categories-section'
import { ReceiptSettings } from '@/components/shop-setting/receipt-settings'

/** ส่วนที่แสดงในหน้านี้ (กลุ่มเมนูด้านบน) */
type SectionId = 'products' | 'categories' | 'equipment' | 'coach' | 'receipts'

/**
 * ตั้งค่าสินค้าร้าน POS (/dashboard/shop-setting)
 * เพิ่ม / แก้ไข / เปิด-ปิด สินค้าที่ขายในหน้าแคชเชียร์ — เก็บในตาราง ShopProduct ผ่าน /api/shop-products
 * สินค้าที่ "เปิดใช้งาน" จะไปโผล่บนหน้า /dashboard/pos-shop ทันที
 * แต่ละ sub-menu แยกเป็นไฟล์ของตัวเอง (ผูกกับ ?section=) ไฟล์นี้ทำหน้าที่แค่ layout + สลับส่วน
 *   products → components/shop-setting/products-section · categories → components/shop-setting/categories-section
 *   receipts → components/shop-setting/receipt-settings · coach/equipment → components/dashboard/*
 */
export default function ShopSettingPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [products, setProducts] = useState<ShopProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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
    if (s === 'products' || s === 'categories' || s === 'equipment' || s === 'coach' || s === 'receipts') setSection(s)
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
              <TabsTrigger
                value="receipts"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <Receipt className="h-4 w-4" /> ใบเสร็จ
              </TabsTrigger>
            </TabsList>

            {/* สินค้าในร้าน (POS) — ไฟล์แยก: components/shop-setting/products-section.tsx */}
            <TabsContent value="products" className="space-y-4">
              <ProductsSection
                products={products}
                loading={loading}
                categories={categories}
                addCategory={addCategory}
                onChanged={loadProducts}
              />
            </TabsContent>

            {/* การ์ดจัดการหมวดสินค้า — ไฟล์แยก: components/shop-setting/categories-section.tsx */}
            <TabsContent value="categories" className="space-y-4">
              <CategoriesSection categories={categories} onUpdated={reloadCategories} />
            </TabsContent>

            {/* การ์ดจัดการอุปกรณ์ให้เช่า — ย้ายมาจากหน้า Dashboard → Equipment */}
            <TabsContent value="equipment" className="space-y-4">
              <EquipmentSection equipment={equipment} onChanged={loadEquipment} />
            </TabsContent>

            {/* รายชื่อโค้ช — UI แบบเดียวกับอุปกรณ์เช่า + วันที่/เวลาว่าง (แก้ไขได้) */}
            <TabsContent value="coach" className="space-y-4">
              <CoachList coaches={coaches} onChanged={loadCoaches} />
            </TabsContent>

            {/* ตั้งค่าใบเสร็จ — 2 คอลัมน์ 60/40 (ตั้งค่าหัวใบเสร็จ + ตัวอย่างใบเสร็จ) */}
            <TabsContent value="receipts" className="space-y-4">
              <ReceiptSettings />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
