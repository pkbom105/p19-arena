/* Shared types for the POS Shop (แคชเชียร์ขายสินค้า) page & components */

/** รหัสหมวดสินค้า = ShopCategory.id ใน DB (ค่าเริ่มต้น cloth | racket | food — เพิ่มหมวดใหม่ได้จากหน้า /dashboard/shop-setting) */
export type ShopCategoryId = string

export interface ShopCategory {
  id: ShopCategoryId
  /** ชื่อบนแท็บ/หัวข้อ (ไทย) */
  label: string
  /** ชื่ออังกฤษสั้น ๆ */
  labelEn: string
  emoji: string
}

/** หมวดสินค้าแบบเต็มแถวจากตาราง ShopCategory — ใช้ในหน้าตั้งค่า (เพิ่ม isActive/sortOrder) */
export interface ShopCategoryRow extends ShopCategory {
  /** ปิดใช้งาน = ซ่อนจากแท็บหน้าแคชเชียร์ (ยังไม่ลบ เพราะสินค้าเดิมอ้างอิง id นี้) */
  isActive: boolean
  sortOrder: number
}

export interface ShopProduct {
  id: string
  name: string
  nameEn: string
  category: ShopCategoryId
  /** ราคาขายต่อหน่วย (บาท) */
  price: number
  /** หน่วยนับ เช่น ตัว / อัน / ขวด */
  unit: string
  emoji: string
  /** บาร์โค้ดสินค้า (EAN/UPC หรือรหัสภายในร้าน) — เว้นว่างได้ (optional เพื่อไม่กระทบหน้าแคชเชียร์/ตะกร้าเดิม) */
  barcode?: string
}

/** 1 บรรทัดในตะกร้า (สินค้า + จำนวน + หมายเหตุ เช่น วัน/เวลา จองโค้ช) */
export interface CartLine {
  product: ShopProduct
  qty: number
  /** หมายเหตุแนบท้ายรายการ (เช่น "จอง 12/10/2026 14:00") */
  note?: string
}

export type PaymentMethod = 'cash' | 'transfer'

/** บิลที่ปิดการขายแล้วในรอบการใช้งานนี้ (ยังไม่บันทึก DB — รีเซ็ตเมื่อ refresh) */
export interface ShopBill {
  /** เลขที่บิลที่แสดงให้ลูกค้า รูปแบบ S-YYMM### (YYMM = ปี/เดือน · ### = running 3 หลักรีเซ็ตรายเดือน) */
  code: string
  /** เลขที่บิลรันในรอบนี้ เช่น 1, 2, 3 */
  no: number
  items: { name: string; qty: number; price: number; note?: string }[]
  subtotal: number
  discount: number
  total: number
  method: PaymentMethod
  /** เงินที่รับมา (เงินสด = ยอดที่กรอก, โอน = เท่ายอดสุทธิ) */
  received: number
  change: number
  /** เวลาที่ปิดบิล (ISO) */
  at: string
}
