/**
 * ข้อมูลหัวใบเสร็จ (branding) ที่ตั้งได้จากหน้า /dashboard/shop-setting?section=receipts
 * เก็บในตาราง Settings แบบ key/value (คีย์ receipt_*) และถูกใช้ร่วมกับใบเสร็จ A5 ที่พิมพ์จริง
 * (pos-shop / shop-report ผ่าน ReceiptDialog)
 */

/** ข้อมูลหัวใบเสร็จที่แสดงบนใบเสร็จ A5 */
export interface ReceiptBranding {
  /** โลโก้ (URL หรือ data URL) — ว่าง = ใช้กล่อง "P19" แทน */
  logo: string
  /** ชื่อร้าน (บรรทัดหลัก) */
  shopName: string
  /** หัวข้อใบเสร็จ เช่น "ใบเสร็จรับเงิน / RECEIPT" */
  title: string
  /** คำโปรย/บรรทัดรองใต้หัวข้อ */
  subheader: string
  /** เลขประจำตัวผู้เสียภาษี */
  taxId: string
}

/** ค่าเริ่มต้น — ตรงกับใบเสร็จเดิมก่อนมีหน้าตั้งค่า */
export const DEFAULT_RECEIPT_BRANDING: ReceiptBranding = {
  logo: '',
  shopName: 'P19 Pickleball Arena',
  title: 'ใบเสร็จรับเงิน / RECEIPT',
  subheader: '',
  taxId: '',
}

/** คีย์ในตาราง Settings ที่ใช้เก็บข้อมูลหัวใบเสร็จ */
export const RECEIPT_BRANDING_KEYS = {
  logo: 'receipt_logo',
  shopName: 'receipt_shop_name',
  title: 'receipt_title',
  subheader: 'receipt_subheader',
  taxId: 'receipt_tax_id',
} as const

/** map key/value จาก /api/settings → ReceiptBranding (ค่าว่าง/ไม่มี = ใช้ค่าเริ่มต้น) */
export function receiptBrandingFromSettings(settings: Record<string, string> | null | undefined): ReceiptBranding {
  const value = (key: string) => (typeof settings?.[key] === 'string' ? settings[key].trim() : '')
  return {
    logo: value(RECEIPT_BRANDING_KEYS.logo),
    shopName: value(RECEIPT_BRANDING_KEYS.shopName) || DEFAULT_RECEIPT_BRANDING.shopName,
    title: value(RECEIPT_BRANDING_KEYS.title) || DEFAULT_RECEIPT_BRANDING.title,
    subheader: value(RECEIPT_BRANDING_KEYS.subheader),
    taxId: value(RECEIPT_BRANDING_KEYS.taxId),
  }
}
