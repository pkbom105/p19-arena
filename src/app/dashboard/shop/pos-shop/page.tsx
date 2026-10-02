'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { DEFAULT_SHOP_PRODUCTS, formatTHB } from '@/components/pos-shop/catalog'
import { useShopCategories } from '@/hooks/use-shop-categories'
import { ShopSummary } from '@/components/pos-shop/shop-summary'
import { ProductGrid, type ShopCategoryFilter } from '@/components/pos-shop/product-grid'
import { CartPanel, type DiscountType } from '@/components/pos-shop/cart-panel'
import { CheckoutDialog } from '@/components/pos-shop/checkout-dialog'
import { ReceiptDialog } from '@/components/pos-shop/receipt-dialog'
import { CoachBookingDialog } from '@/components/pos-shop/coach-booking-dialog'
import { RecentBills, type RecentBill } from '@/components/pos-shop/recent-bills'
import type { CartLine, PaymentMethod, ShopBill, ShopProduct } from '@/components/pos-shop/types'

/**
 * POS ร้านค้า (/dashboard/pos-shop) — แคชเชียร์ขายเสื้อผ้า / แร็กเก็ต & อุปกรณ์ / อาหาร & ขนม
 * สินค้าดึงจากตาราง ShopProduct ผ่าน /api/shop-products — ต้องตรงกับหน้า /dashboard/shop-setting เสมอ
 * (เพิ่ม/แก้ไข/ปิดใช้งานได้ที่หน้านั้น) · ถ้าเรียก API ไม่สำเร็จจะใช้ชุดสำรองในโค้ดแทนชั่วคราว
 * ปิดบิลแล้วบันทึกใบเสร็จลงตาราง ShopReceipt (ผ่าน /api/shop-receipts) — ยอดสรุปด้านบนยังนับเฉพาะรอบการใช้งานนี้
 */
export default function PosShopPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [products, setProducts] = useState<ShopProduct[]>(DEFAULT_SHOP_PRODUCTS)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<ShopCategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  /** สินค้าโค้ชที่กำลังเลือกวัน/เวลา */
  const [coachProduct, setCoachProduct] = useState<ShopProduct | null>(null)
  const [coachDialogOpen, setCoachDialogOpen] = useState(false)
  const [discountType, setDiscountType] = useState<DiscountType>('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const [bills, setBills] = useState<ShopBill[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  /** บิลที่เพิ่งปิดการขาย — เปิด dialog ใบเสร็จ A5 ให้พิมพ์/บันทึก PDF */
  const [receipt, setReceipt] = useState<ShopBill | null>(null)
  /** true = กด "พิมพ์" จากลิสต์บิลล่าสุด → ให้ dialog สั่งพิมพ์เองเมื่อใบเสร็จพร้อม */
  const [autoPrint, setAutoPrint] = useState(false)
  /** 3 ใบเสร็จล่าสุดจาก DB (บล็อก "บิลล่าสุด" ใต้ปุ่มชำระเงิน) */
  const [recentReceipts, setRecentReceipts] = useState<RecentBill[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  // หมวดสินค้าจากตาราง ShopCategory — เพิ่มหมวดใหม่ได้จากหน้า /dashboard/shop-setting
  const { categories } = useShopCategories()

  /**
   * โหลดสินค้าจาก DB (เฉพาะที่เปิดใช้งาน) — ใช้ข้อมูลจาก DB เป็นแหล่งจริงเสมอ
   * ชุดสำรองในโค้ดจะถูกใช้เฉพาะเมื่อ "เรียก API ไม่สำเร็จ" (เช่น server ยังไม่พร้อม)
   */
  const loadProducts = useCallback(async (silent?: boolean) => {
    if (silent) setRefreshing(true)
    try {
      const res = await fetch(apiUrl('/api/shop-products'))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) setProducts(data)
    } catch (err) {
      console.error('Failed to fetch shop products', err)
    } finally {
      if (silent) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  /** โหลด 3 ใบเสร็จล่าสุดจากตาราง ShopReceipt (เรียกซ้ำหลังปิดบิลทุกครั้ง) */
  const loadRecentReceipts = useCallback(async () => {
    setRecentLoading(true)
    try {
      const res = await fetch(apiUrl('/api/shop-receipts?limit=3'))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data)) setRecentReceipts(data)
    } catch (err) {
      console.error('Failed to fetch recent receipts', err)
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecentReceipts()
  }, [loadRecentReceipts])

  // สินค้าที่แสดง = หมวดที่เลือก + คำค้นหา
  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q))
  }, [category, search, products])

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.product.price * l.qty, 0), [lines])
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0)
  // ส่วนลด: เปอร์เซ็นต์ (ไม่เกิน 100%) หรือจำนวนเงิน (ไม่เกินยอดรวมสินค้า)
  const discount = discountType === 'percent'
    ? Math.round((subtotal * Math.min(discountValue, 100)) / 100)
    : Math.min(discountValue, subtotal)
  const total = Math.max(0, subtotal - discount)

  const addProduct = (product: ShopProduct) => {
    // สินค้าหมวด "โค้ช" ต้องเลือกวัน/เวลาก่อนเพิ่ม
    if (product.category === 'coach') {
      setCoachProduct(product)
      setCoachDialogOpen(true)
      return
    }
    addLine(product)
  }

  const addLine = (product: ShopProduct, note?: string, qty = 1) => {
    setLines((prev) => {
      // รายการโค้ช (มีวัน/เวลา) — แยกบรรทัดต่อการจอง · qty = จำนวนชั่วโมง
      if (note) return [...prev, { product, qty, note }]
      const found = prev.find((l) => l.product.id === product.id && !l.note)
      if (found) return prev.map((l) => (l.product.id === product.id && !l.note ? { ...l, qty: l.qty + 1 } : l))
      return [...prev, { product, qty: 1 }]
    })
  }

  const confirmCoachBooking = (date: Date, startTime: string, endTime: string) => {
    if (!coachProduct) return
    const hours = Math.max(1, Number(endTime.slice(0, 2)) - Number(startTime.slice(0, 2)))
    addLine(coachProduct, `จอง ${format(date, 'dd/MM/yyyy')} ${startTime}-${endTime} น.`, hours)
    setCoachDialogOpen(false)
    setCoachProduct(null)
  }

  const incLine = (id: string) => {
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, qty: l.qty + 1 } : l)))
  }

  // ลดจำนวน — ถ้าเหลือ 0 ให้เอาออกจากตะกร้า
  const decLine = (id: string) => {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.product.id !== id) return [l]
        return l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1 }]
      })
    )
  }

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.product.id !== id))

  const clearCart = () => {
    setLines([])
    setDiscountType('amount')
    setDiscountValue(0)
  }

  /**
   * เลขที่บิลถัดไปของเดือนนี้ (S-YYMM###) — คำนวณจากบิลล่าสุดที่โหลดมา เพื่อให้ dialog ใบเสร็จโชว์เลขได้ทันที
   * ตัวจริงคือเลขที่เซิร์ฟเวอร์สร้างตอนบันทึกลง DB — ด้านล่างจะเทียบและทับให้ตรงกับ DB อีกครั้ง
   */
  const nextBillCode = () => {
    const now = new Date()
    const prefix = `S-${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastRunning = recentReceipts
      .filter((r) => r.code.startsWith(prefix))
      .reduce((max, r) => Math.max(max, Number.parseInt(r.code.slice(prefix.length), 10) || 0), 0)
    return `${prefix}${String(lastRunning + 1).padStart(3, '0')}`
  }

  const confirmPayment = ({ method, received }: { method: PaymentMethod; received: number }) => {
    const bill: ShopBill = {
      code: nextBillCode(),
      no: bills.length + 1,
      items: lines.map((l) => ({ name: l.product.name, qty: l.qty, price: l.product.price, note: l.note })),
      subtotal,
      discount,
      total,
      method,
      received,
      change: Math.max(0, received - total),
      at: new Date().toISOString(),
    }
    setBills((prev) => [...prev, bill])
    setReceipt(bill)
    setCheckoutOpen(false)
    clearCart()
    toast.success(
      `ชำระเงินสำเร็จ · บิล ${bill.code} · ${formatTHB(bill.total)}` +
      (bill.change > 0 ? ` · ทอน ${formatTHB(bill.change)}` : '')
    )

    // บันทึกใบเสร็จลงฐานข้อมูล (best-effort) — ล้มเหลวไม่บล็อกการขาย แต่แจ้งให้รู้ว่าบิลนี้จะไม่ขึ้นในหน้ารายงาน
    fetch(apiUrl('/api/shop-receipts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtotal: bill.subtotal,
        discount: bill.discount,
        total: bill.total,
        method: bill.method,
        received: bill.received,
        change: bill.change,
        items: bill.items,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const saved = await res.json()
        // เลขที่บิลจริงจาก DB — ถ้าค่าที่คำนวณไว้ก่อนบันทึกไม่ตรง ให้ทับด้วยของจริง (กันใบเสร็จพิมพ์เลขผิด)
        if (saved?.code && saved.code !== bill.code) {
          setBills((prev) => prev.map((b) => (b === bill ? { ...b, code: saved.code } : b)))
          setReceipt((cur) => (cur === bill ? { ...cur, code: saved.code } : cur))
        }
        // ให้บล็อก "บิลล่าสุด" ใต้ปุ่มชำระเงินอัปเดตทันทีหลังปิดบิล
        return loadRecentReceipts()
      })
      .catch((err) => {
        console.error('Failed to save shop receipt', err)
        toast.error('บันทึกใบเสร็จลงฐานข้อมูลไม่สำเร็จ — บิลนี้จะไม่ขึ้นในหน้า shop-report')
      })
  }

  const totalSales = bills.reduce((sum, b) => sum + b.total, 0)
  const soldItems = bills.reduce((sum, b) => sum + b.items.reduce((n, i) => n + i.qty, 0), 0)
  const avgPerBill = bills.length > 0 ? Math.round(totalSales / bills.length) : 0

  /** เปิดใบเสร็จของบิลที่เลือกจากลิสต์บิลล่าสุด (map แถว DB → รูปแบบบิลของหน้าแคชเชียร์) */
  const openBill = (row: RecentBill, print = false) => {
    setAutoPrint(print)
    setReceipt({
      code: row.code,
      no: row.no,
      items: row.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, note: i.note ?? undefined })),
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      method: row.method === 'transfer' ? 'transfer' : 'cash',
      received: row.received,
      change: row.change,
      at: row.soldAt,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <PosHeader date={todayStr} refreshing={refreshing} title="pos-shop" onRefresh={() => loadProducts(true)} />
      <PosMobileNav active="pos-shop" shopOnly />

      <div className="flex flex-1">
        <PosSidebar active="pos-shop" shopOnly />

        <main className="min-w-0 flex-1 space-y-4 px-4 py-5 lg:pl-4">
          <ShopSummary totalSales={totalSales} billCount={bills.length} soldItems={soldItems} avgPerBill={avgPerBill} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <ProductGrid
              products={visibleProducts}
              categories={categories}
              category={category}
              onCategory={setCategory}
              search={search}
              onSearch={setSearch}
              onAdd={addProduct}
            />
            {/* คอลัมน์ขวา: ตะกร้า กับ "บิลล่าสุด" แยกเป็นคนละการ์ด — sticky ทั้งคอลัมน์ */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
              <CartPanel
                lines={lines}
                subtotal={subtotal}
                discount={discount}
                discountType={discountType}
                discountValue={discountValue}
                onDiscountType={setDiscountType}
                onDiscountValue={setDiscountValue}
                total={total}
                onInc={incLine}
                onDec={decLine}
                onRemove={removeLine}
                onClear={clearCart}
                onCheckout={() => setCheckoutOpen(true)}
              />
              <RecentBills
                receipts={recentReceipts}
                loading={recentLoading}
                onView={(bill) => openBill(bill)}
                onPrint={(bill) => openBill(bill, true)}
              />
            </div>
          </div>
        </main>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        total={total}
        itemCount={itemCount}
        onOpenChange={setCheckoutOpen}
        onConfirm={confirmPayment}
      />

      <CoachBookingDialog
        product={coachProduct}
        open={coachDialogOpen}
        onOpenChange={setCoachDialogOpen}
        onConfirm={confirmCoachBooking}
      />

      <ReceiptDialog
        bill={receipt}
        open={Boolean(receipt)}
        autoPrint={autoPrint}
        onOpenChange={(open) => {
          if (!open) {
            setReceipt(null)
            setAutoPrint(false)
          }
        }}
      />
    </div>
  )
}
