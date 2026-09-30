/* Shared types for the Shop Setting page (จัดการสินค้าของร้าน POS) */

import type { ShopProduct } from '@/components/pos-shop/types'

/** สินค้าในฐานข้อมูล — เพิ่ม isActive/sortOrder จาก ShopProduct ที่หน้าแคชเชียร์ใช้ */
export interface ShopProductRow extends ShopProduct {
  isActive: boolean
  sortOrder: number
  /** จำนวนสต็อกเริ่มต้น (กรอกเองที่หน้าตั้งค่า · ค่าเริ่มต้น 0) */
  stockStart?: number
  /** ราคาทุนต่อหน่วย (กรอกเอง) — กำไรต่อหน่วย = ราคาขาย − ราคาทุน */
  costPrice?: number
  /** จำนวนที่ขายได้จริง — เซิร์ฟเวอร์คำนวณจากรายการในบิลขาย (อ่านเท่านั้น) */
  soldQty?: number
  /** คงเหลือ = stockStart − soldQty (ติดลบได้ = ขายเกินสต็อกตั้งต้น) */
  stockLeft?: number
  createdAt?: string
  updatedAt?: string
}
