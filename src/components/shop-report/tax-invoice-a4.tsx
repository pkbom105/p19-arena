'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatTHB } from '@/components/pos-shop/catalog'
import type { TaxInvoiceSeller } from '@/lib/tax-invoice'

/** 1 บรรทัดในใบกำกับภาษี */
export interface TaxInvoiceItem {
  name: string
  qty: number
  price: number
  note?: string
}

/** ข้อมูลผู้ซื้อ (ลูกค้า) — "fill text" ในหน้าตั้งค่า */
export interface TaxInvoiceBuyer {
  name: string
  address: string
  taxId: string
}

/** เลขที่/วันที่ของเอกสาร */
export interface TaxInvoiceDoc {
  /** เลขที่ใบกำกับภาษีเต็มรูปแบบ (เช่น T-2609004) */
  no: string
  date: string
  /** เลขที่ใบกำกับอย่างย่อ/ใบเสร็จเดิมที่ถูกยกเลิก (เช่น S-2609004) — ใช้ในบรรทัดหมายเหตุท้ายบิล */
  refNo?: string
}

const VAT_RATE = 7

/** 1 บรรทัดสรุปยอดเงิน (ป้ายซ้าย / ตัวเลขขวา) */
function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={'flex items-center justify-between ' + (strong ? 'font-semibold' : 'text-slate-600')}>
      <span>{label}</span>
      <span className={strong ? 'text-slate-900' : ''}>{value}</span>
    </div>
  )
}

/**
 * ใบกำกับภาษีเต็มรูปแบบ ขนาด A4 (210×297 มม.)
 * ราคาสินค้ารวม VAT แล้ว → แยก "มูลค่าก่อน VAT" + "VAT 7%" ให้อัตโนมัติ
 * @param preview true = ย่อให้เต็มความกว้างคอลัมน์ (หน้าตั้งค่า) · false = ขนาด A4 จริง (สำหรับพิมพ์)
 */
export function TaxInvoiceA4({ seller, buyer, items, doc, preview = false }: {
  seller: TaxInvoiceSeller
  buyer: TaxInvoiceBuyer
  items: TaxInvoiceItem[]
  doc: TaxInvoiceDoc
  preview?: boolean
}) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  // ราคารวม VAT แล้ว → มูลค่าก่อน VAT = subtotal / 1.07
  const baseBeforeVat = Math.round((subtotal / (1 + VAT_RATE / 100)) * 100) / 100
  const vat = Math.round((subtotal - baseBeforeVat) * 100) / 100
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0)

  return (
    <div
      data-slot="tax-invoice-a4"
      className={
        'mx-auto flex flex-col gap-3 rounded-lg border bg-white text-slate-900 shadow-sm ' +
        (preview ? 'w-full min-h-0 p-4' : 'w-[210mm] min-h-[297mm] p-[12mm]')
      }
    >
      {/* หัวเอกสาร: ผู้ขาย + ชื่อเอกสาร */}
      <div className="flex items-start justify-between gap-4 border-b pb-3">
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight">{seller.company}</div>
          <div className="whitespace-pre-line text-[11px] text-slate-600">{seller.address}</div>
          <div className="text-[11px] text-slate-600">เลขประจำตัวผู้เสียภาษี {seller.taxId}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold leading-tight">ใบกำกับภาษี / ใบเสร็จรับเงิน</div>
          <div className="text-[11px] text-slate-500">TAX INVOICE (เต็มรูปแบบ)</div>
          {/* ย้ายมาจากบล็อก "ข้อมูลร้าน / เครื่อง POS" (ที่ลบออก) — ต่อท้ายใต้ TAX INVOICE */}
          <div className="mt-1 text-[11px]">วันที่ {doc.date}</div>
          <div className="text-[11px]">เลขที่ใบกำกับ {doc.no}</div>
          <div className="text-[11px]">Shop Name: {seller.shopName}</div>
          <div className="text-[11px]">POS ID: {seller.posId}</div>
        </div>
      </div>

      {/* ข้อมูลผู้ซื้อ (ลูกค้า) — เต็มความกว้าง */}
      <div className="rounded border p-2 text-[11px]">
        <div className="mb-0.5 font-semibold text-slate-700">ข้อมูลผู้ซื้อ (ลูกค้า)</div>
        <div>ชื่อ: {buyer.name || '—'}</div>
        <div className="whitespace-pre-line">ที่อยู่: {buyer.address || '—'}</div>
        <div>เลขประจำตัวผู้เสียภาษี: {buyer.taxId || '—'}</div>
      </div>

      {/* ตารางรายการสินค้า */}
      <table className="w-full border-collapse text-[11px]">
        <thead className="border-y bg-slate-100 text-slate-700">
          <tr>
            <th className="w-8 px-1 py-1 text-left font-semibold">#</th>
            <th className="px-1 py-1 text-left font-semibold">รายการ</th>
            <th className="w-14 px-1 py-1 text-right font-semibold">จำนวน</th>
            <th className="w-24 px-1 py-1 text-right font-semibold">ราคา/หน่วย</th>
            <th className="w-24 px-1 py-1 text-right font-semibold">รวม</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={`${it.name}-${i}`} className="border-b">
              <td className="px-1 py-1 align-top">{i + 1}</td>
              <td className="px-1 py-1 align-top">
                {it.name}
                {it.note && <div className="text-[9px] text-slate-500">{it.note}</div>}
              </td>
              <td className="px-1 py-1 text-right align-top">{it.qty}</td>
              <td className="px-1 py-1 text-right align-top">{formatTHB(it.price)}</td>
              <td className="px-1 py-1 text-right align-top font-medium">{formatTHB(it.price * it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* สรุปยอดเงิน + VAT */}
      <div className="ml-auto w-full max-w-[95mm] space-y-1 text-[11px]">
        <AmountRow label={`มูลค่าสินค้าก่อน VAT (${totalQty} ชิ้น)`} value={formatTHB(baseBeforeVat)} />
        <AmountRow label={`ภาษีมูลค่าเพิ่ม ${VAT_RATE}%`} value={formatTHB(vat)} />
        <div className="flex items-center justify-between border-y border-slate-300 py-1.5 text-base font-bold">
          <span>ยอดรวมทั้งสิ้น</span>
          <span>{formatTHB(subtotal)}</span>
        </div>
        <div className="text-[10px] text-slate-500">ราคาสินค้ารวมภาษีมูลค่าเพิ่มแล้ว</div>
      </div>

      {/* หมายเหตุด้านล่างบิล — อ้างถึงใบกำกับภาษีอย่างย่อ (ใบเสร็จ) ที่ถูกยกเลิก */}
      {doc.refNo && (
        <div className="rounded border border-dashed border-slate-300 px-2 py-1.5 text-[10px] text-slate-600">
          หมายเหตุ : ยกเลิกใบกำกับภาษีอย่างย่อ เลขที่ {doc.refNo} เพื่อออกใบกำกับภาษีเต็มรูปแบบแทน
        </div>
      )}

      {/* ช่องลงนาม */}
      <div className="mt-auto grid grid-cols-2 gap-6 pt-8 text-center text-[11px] text-slate-600">
        <div className="border-t border-dashed pt-1">ผู้รับสินค้า / ผู้ซื้อ</div>
        <div className="border-t border-dashed pt-1">ผู้มีอำนาจลงนาม / ผู้ขาย</div>
      </div>

      {/* ท้ายเอกสาร */}
      <div className="border-t border-dashed pt-2 text-center text-[10px] text-slate-500">
        <div>{seller.company} · เอกสารออกโดยระบบ POS อัตโนมัติ</div>
      </div>
    </div>
  )
}

/**
 * CSS สำหรับพิมพ์ — บังคับกระดาษ A4 แนวตั้ง และซ่อนทั้งแอปให้เหลือเฉพาะใบกำกับ
 * (ใช้กับสำเนาที่ portal ไป <body>)
 */
const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(#tax-invoice-print-root) { display: none !important; }
  #tax-invoice-print-root { position: static !important; left: auto !important; top: auto !important; }
  #tax-invoice-print-root [data-slot="tax-invoice-a4"] {
    width: auto !important;
    max-width: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
}
`

/** สำเนาสำหรับพิมพ์ — portal ไป <body> เพื่อให้ @media print ซ่อนทั้งแอปได้เหลือเฉพาะใบกำกับ */
export function TaxInvoicePrintRoot(props: {
  seller: TaxInvoiceSeller
  buyer: TaxInvoiceBuyer
  items: TaxInvoiceItem[]
  doc: TaxInvoiceDoc
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return createPortal(
    <div id="tax-invoice-print-root" aria-hidden className="fixed left-[-9999px] top-0">
      <style>{PRINT_CSS}</style>
      <TaxInvoiceA4 {...props} />
    </div>,
    document.body
  )
}
