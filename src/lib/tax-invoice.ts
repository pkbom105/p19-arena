/**
 * ข้อมูลผู้ขาย (seller) สำหรับใบกำกับภาษีเต็มรูปแบบ A4
 * ตั้งได้จากหน้า /dashboard/shop/shop-report?section=tax-invoice — เก็บในตาราง Settings (คีย์ tax_invoice_*)
 */

/** ข้อมูลผู้ขาย/ร้าน ที่พิมพ์บนหัวใบกำกับภาษี */
export interface TaxInvoiceSeller {
  /** ชื่อบริษัท/นิติบุคคล (บรรทัดหลัก) */
  company: string
  /** ที่อยู่บริษัท (ใส่หลายบรรทัดได้) */
  address: string
  /** เลขประจำตัวผู้เสียภาษีของบริษัท */
  taxId: string
  /** ชื่อร้าน/สาขา */
  shopName: string
  /** รหัสเครื่อง POS */
  posId: string
}

/** ค่าเริ่มต้นตามที่กำหนด */
export const DEFAULT_TAX_INVOICE_SELLER: TaxInvoiceSeller = {
  company: 'บริษัท เบทเทอร์แลนด์ ดีเวลลอปเมนท์ จำกัด',
  address: '351/1 ถนนพุทธบูชา แขวงบางมด เขตจอมทอง กรุงเทพฯ 10150',
  taxId: '0105564059611',
  shopName: 'Pickelbal arena',
  posId: '1001',
}

/** คีย์ในตาราง Settings ที่ใช้เก็บข้อมูลผู้ขายของใบกำกับ */
export const TAX_INVOICE_SELLER_KEYS = {
  company: 'tax_invoice_company',
  address: 'tax_invoice_address',
  taxId: 'tax_invoice_tax_id',
  shopName: 'tax_invoice_shop_name',
  posId: 'tax_invoice_pos_id',
} as const

/** map key/value จาก /api/settings → TaxInvoiceSeller (ค่าว่าง/ไม่มี = ใช้ค่าเริ่มต้น) */
export function taxInvoiceSellerFromSettings(settings: Record<string, string> | null | undefined): TaxInvoiceSeller {
  const value = (key: string) => (typeof settings?.[key] === 'string' ? settings[key] : '')
  return {
    company: value(TAX_INVOICE_SELLER_KEYS.company).trim() || DEFAULT_TAX_INVOICE_SELLER.company,
    address: value(TAX_INVOICE_SELLER_KEYS.address).trim() || DEFAULT_TAX_INVOICE_SELLER.address,
    taxId: value(TAX_INVOICE_SELLER_KEYS.taxId).trim() || DEFAULT_TAX_INVOICE_SELLER.taxId,
    shopName: value(TAX_INVOICE_SELLER_KEYS.shopName).trim() || DEFAULT_TAX_INVOICE_SELLER.shopName,
    posId: value(TAX_INVOICE_SELLER_KEYS.posId).trim() || DEFAULT_TAX_INVOICE_SELLER.posId,
  }
}

/**
 * แปลงเลขที่บิลใบเสร็จ (S-YYMM###) → เลขที่ใบกำกับภาษีเต็มรูปแบบ (T-YYMM###)
 * เช่น S-2609004 → T-2609004 · ถ้าไม่มี prefix S- จะเติม T- ให้
 */
export function taxInvoiceNo(receiptCode: string): string {
  const code = (receiptCode || '').trim()
  if (!code) return ''
  return /^S-/i.test(code) ? `T-${code.slice(2)}` : `T-${code}`
}

