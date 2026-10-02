'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { formatTHB } from './catalog'
import type { ShopBill } from './types'

/** หัวใบเสร็จ — ชื่อร้านเดียวกับใบเสร็จหน้า booking */
const SHOP_NAME = 'P19 Pickleball Arena'
/** เบอร์พร้อมเพย์ของสนาม (ตัวเดียวกับ components/qrcode.tsx) */
const PROMPTPAY_DISPLAY = '089-699-3979'

/**
 * CSS สำหรับพิมพ์ — บังคับกระดาษ A5 แนวตั้ง และซ่อนทั้งแอปให้เหลือเฉพาะใบเสร็จ
 * (ใช้กับสำเนาที่ portal ไป <body> เพื่อให้ซ่อน body child อื่นได้ทั้งหมด)
 */
const PRINT_CSS = `
@page { size: A5 portrait; margin: 30mm 12mm 10mm; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(#receipt-print-root) { display: none !important; }
  #receipt-print-root { position: static !important; left: auto !important; top: auto !important; width: 85% !important; margin: 0 auto !important; }
  #receipt-print-root [data-slot="receipt-a5"] {
    width: auto !important;
    max-width: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
}
`

/** 1 บรรทัดในสรุปยอดเงิน (ป้ายซ้าย / ตัวเลขขวา) */
function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={'flex items-center justify-between ' + (strong ? 'font-semibold' : 'text-slate-600')}>
      <span>{label}</span>
      <span className={strong ? 'text-slate-900' : ''}>{value}</span>
    </div>
  )
}

/** ใบเสร็จขนาด A5 แนวตั้ง (148×210 มม.) — ใช้ทั้งตัวอย่างใน dialog และตัวที่พิมพ์ออกกระดาษ */
export function ReceiptA5({ bill, qrDataUrl }: { bill: ShopBill; qrDataUrl?: string | null }) {
  const methodLabel = bill.method === 'cash' ? 'เงินสด' : 'โอน / QR'
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div
      data-slot="receipt-a5"
      className="mx-auto flex w-[148mm] min-h-[210mm] flex-col gap-3 rounded-lg border bg-white p-[10mm] text-slate-900 shadow-sm"
    >
      {/* หัวใบเสร็จ */}
      <div className="flex items-start gap-3 border-b border-dashed pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          P19
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight">{SHOP_NAME}</div>
          <div className="text-[11px] text-slate-500">ใบเสร็จรับเงิน / RECEIPT</div>
        </div>
        <div className="ml-auto shrink-0 text-right text-[11px] text-slate-500">
          <div className="text-sm font-bold text-slate-900">เลขที่บิล {bill.code}</div>
          <div>{format(new Date(bill.at), 'd MMM yyyy HH:mm')}</div>
        </div>
      </div>

      {/* ข้อมูลบิล */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">วิธีชำระเงิน</span>
          <span className="font-medium">{methodLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">จำนวนสินค้า</span>
          <span className="font-medium">{totalQty} ชิ้น</span>
        </div>
      </div>

      {/* ตารางรายการสินค้า */}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y bg-slate-100 text-slate-700">
            <th className="px-1 py-1 text-left font-semibold">#</th>
            <th className="px-1 py-1 text-left font-semibold">รายการ</th>
            <th className="px-1 py-1 text-right font-semibold">จำนวน</th>
            <th className="px-1 py-1 text-right font-semibold">ราคา/หน่วย</th>
            <th className="px-1 py-1 text-right font-semibold">รวม</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-dashed">
              <td className="px-1 py-1 align-top">{index + 1}</td>
              <td className="px-1 py-1 align-top">
                {item.name}
                {item.note && <div className="text-[9px] text-slate-500">{item.note}</div>}
              </td>
              <td className="px-1 py-1 text-right align-top">{item.qty}</td>
              <td className="px-1 py-1 text-right align-top">{formatTHB(item.price)}</td>
              <td className="px-1 py-1 text-right align-top font-medium">{formatTHB(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* สรุปยอดเงิน */}
      <div className="ml-auto w-full max-w-[75mm] space-y-1 text-[11px]">
        <AmountRow label={`รวมสินค้า (${totalQty} ชิ้น)`} value={formatTHB(bill.subtotal)} />
        {bill.discount > 0 && <AmountRow label="ส่วนลด" value={`-${formatTHB(bill.discount)}`} />}
        <div className="flex items-center justify-between border-y border-slate-300 py-1.5 text-base font-bold">
          <span>ยอดสุทธิ</span>
          <span>{formatTHB(bill.total)}</span>
        </div>
        <AmountRow label="รับเงิน" value={formatTHB(bill.received)} />
        <AmountRow label="เงินทอน" value={formatTHB(bill.change)} />
      </div>

      {/* PromptPay QR — ยอดเดียวกับบิล */}
      <div className="mt-auto flex items-center gap-3 rounded-lg border border-dashed p-3">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="PromptPay QR" className="h-[30mm] w-[30mm] shrink-0" />
        ) : (
          <div className="h-[30mm] w-[30mm] shrink-0 animate-pulse rounded bg-slate-100" />
        )}
        <div className="text-[11px] leading-relaxed">
          <div className="font-semibold">ชำระด้วยพร้อมเพย์ (PromptPay)</div>
          <div className="text-slate-500">{PROMPTPAY_DISPLAY}</div>
          <div className="text-slate-500">สแกนเพื่อชำระยอด {formatTHB(bill.total)}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">ชำระเงินเรียบร้อยแล้ว</div>
        </div>
      </div>

      {/* ท้ายใบเสร็จ */}
      <div className="border-t border-dashed pt-2 text-center text-[10px] text-slate-500">
        <div className="text-[11px] font-medium text-slate-700">ขอบคุณที่ใช้บริการ 🙏</div>
        <div>{SHOP_NAME} · ใบเสร็จออกโดยระบบ POS อัตโนมัติ</div>
        <div>เก็บใบเสร็จนี้ไว้เป็นหลักฐานการชำระเงิน</div>
      </div>
    </div>
  )
}

/** สำเนาสำหรับพิมพ์ — portal ไป <body> เพื่อให้ @media print ซ่อนทั้งแอปได้เหลือเฉพาะใบเสร็จ */
export function ReceiptPrintRoot({ bill, qrDataUrl }: { bill: ShopBill; qrDataUrl?: string | null }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return createPortal(
    <div id="receipt-print-root" aria-hidden className="fixed left-[-9999px] top-0">
      <style>{PRINT_CSS}</style>
      <ReceiptA5 bill={bill} qrDataUrl={qrDataUrl} />
    </div>,
    document.body
  )
}
