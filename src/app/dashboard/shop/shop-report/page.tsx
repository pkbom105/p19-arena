'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, BarChart3, FileText, GraduationCap, Receipt, Wrench } from 'lucide-react'
import { apiUrl, BASE_PATH } from '@/lib/api'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useShopCategories } from '@/hooks/use-shop-categories'
import type { ShopProductRow } from '@/components/shop-setting/types'
import type { Equipment } from '@/components/dashboard/types'
import { CoachSection } from '@/components/dashboard/coach-section'
import { EquipmentSection } from '@/components/dashboard/equipment-section'
import { OverviewSection } from '@/components/shop-report/overview-section'
import { ReceiptsSection, type ShopReceiptRow } from '@/components/shop-report/receipts-section'
import { TaxInvoiceSettings } from '@/components/shop-report/tax-invoice-settings'

/**
 * รายงานร้านค้า (/dashboard/shop/shop-report) — หน้าดูอย่างเดียว (แก้ไขที่ /dashboard/shop-setting)
 * แต่ละ sub-menu แยกเป็นไฟล์ของตัวเอง (ผูกกับ ?section=) ไฟล์นี้ทำหน้าที่แค่ layout + สลับส่วน
 *   overview → components/shop-report/overview-section · receipts → components/shop-report/receipts-section
 *   tax-invoice → components/shop-report/tax-invoice-settings · coach/equipment → components/dashboard/*-section
 */

/** ส่วนที่แสดงในหน้านี้ (กลุ่มเมนูด้านบน) */
type SectionId = 'overview' | 'receipts' | 'coach' | 'equipment' | 'tax-invoice'

export default function ShopReportPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [products, setProducts] = useState<ShopProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [receipts, setReceipts] = useState<ShopReceiptRow[]>([])
  const [receiptLoading, setReceiptLoading] = useState(true)
  const [receiptError, setReceiptError] = useState<string | null>(null)

  // รวมหมวดที่ปิดใช้งานด้วย เพื่อให้ยอดรวมตรงกับสินค้าที่อ้างหมวดนั้นอยู่
  const { categories } = useShopCategories(true)

  // อุปกรณ์ให้เช่า (RentalEquipment) — สำหรับแท็บ "อุปกรณ์เช่า" (เฉพาะที่ชำระเงินแล้ว)
  const [equipment, setEquipment] = useState<Equipment[]>([])

  /** ส่วนที่กำลังแสดง: dashboard รวม report หรือ ตารางใบเสร็จ (ผูกกับ ?section=) */
  const [section, setSection] = useState<SectionId>('overview')

  // อ่าน ?section= ตอนเปิดหน้า (ทำใน effect เพื่อไม่ให้ hydration ไม่ตรงกัน)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('section')
    if (s === 'overview' || s === 'receipts' || s === 'coach' || s === 'equipment' || s === 'tax-invoice') setSection(s)
  }, [])

  /** สลับส่วน + sync URL โดยไม่โหลดหน้าใหม่ (แบบเดียวกับหน้า /dashboard/shop-setting) */
  const goSection = (next: SectionId) => {
    setSection(next)
    window.history.pushState(null, '', `${BASE_PATH}/dashboard/shop/shop-report?section=${next}`)
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

  /** โหลดอุปกรณ์ให้เช่าที่ชำระเงินแล้ว — ใช้ในแท็บอุปกรณ์เช่า */
  const loadEquipment = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/equipment?paid=1'))
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
      <PosMobileNav active="shop-report" shopOnly />

      <div className="flex flex-1">
        <PosSidebar active="shop-report" shopOnly />

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
              <TabsTrigger
                value="coach"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <GraduationCap className="h-4 w-4" /> โค้ช
              </TabsTrigger>
              <TabsTrigger
                value="equipment"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <Wrench className="h-4 w-4" /> อุปกรณ์เช่า
              </TabsTrigger>
              <TabsTrigger
                value="tax-invoice"
                className="h-[4.5rem] flex-1 gap-2 whitespace-normal rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-center text-xs leading-tight font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:flex-none sm:px-8 sm:text-base"
              >
                <FileText className="h-4 w-4" /> ใบกำกับเต็มรูปแบบ
              </TabsTrigger>
            </TabsList>

            {/* dashboard รวม report — ไฟล์แยก: components/shop-report/overview-section.tsx */}
            <TabsContent value="overview" className="space-y-4">
              <OverviewSection products={products} categories={categories} loading={loading} />
            </TabsContent>

            {/* ใบเสร็จ จาก pos-shop — ไฟล์แยก: components/shop-report/receipts-section.tsx */}
            <TabsContent value="receipts" className="space-y-4">
              <ReceiptsSection receipts={receipts} loading={receiptLoading} error={receiptError} />
            </TabsContent>

            {/* โค้ช — จัดการจองโค้ช (ย้ายมาจาก Dashboard → Coach) */}
            <TabsContent value="coach" className="space-y-4">
              <CoachSection />
            </TabsContent>

            {/* อุปกรณ์ให้เช่า — จัดการอุปกรณ์เช่า (ย้ายมาจาก Dashboard → Equipment) */}
            <TabsContent value="equipment" className="space-y-4">
              <EquipmentSection equipment={equipment} onChanged={loadEquipment} />
            </TabsContent>

            {/* ใบกำกับภาษีเต็มรูปแบบ (A4) — ไฟล์แยก: components/shop-report/tax-invoice-settings.tsx */}
            <TabsContent value="tax-invoice" className="space-y-4">
              <TaxInvoiceSettings />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
