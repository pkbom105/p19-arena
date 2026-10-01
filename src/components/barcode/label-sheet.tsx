'use client'

import { Ean13Svg } from './ean13-svg'
import { QrSvg } from './qr-svg'
import { LABEL_SPEC, SIDE_MARGIN_MM, sheetHeightMm } from './label-spec'

export interface LabelItem {
  code: string
  name?: string
  price?: number
  qrText?: string
  /** รูปแบบที่พิมพ์บนฉลาก: 1D (EAN-13) · 2D (QR) · ทั้งคู่ */
  codeType?: 'ean' | 'qr' | 'both'
}

/** 1 ดวง — ขนาดจริง 34 × 20 mm · เนื้อหาตาม codeType (slot: bc-cell = ในแผ่น, bc-label-single = preview เดี่ยว) */
function Label({ item, slot }: { item: LabelItem; slot: string }) {
  const type = item.codeType || 'both'
  const priceText = item.price != null ? `฿${item.price.toLocaleString('th-TH')}` : ''
  return (
    <div
      data-slot={slot}
      style={{ width: `${LABEL_SPEC.labelWidthMm}mm`, height: `${LABEL_SPEC.labelHeightMm}mm` }}
      className="flex shrink-0 gap-[0.6mm] overflow-hidden border border-dashed border-neutral-300 bg-white p-[0.6mm] text-black"
    >
      {type === 'qr' ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div data-slot="bc-title" className="mx-auto w-full truncate text-center text-[2.2mm] leading-tight font-semibold">{item.name || '—'}</div>
          <div data-slot="bc-bottom" className="mt-[0.4mm] grid flex-1 grid-cols-2 items-center gap-[0.8mm]">
            <QrSvg text={item.qrText || item.code} className="mx-auto h-[9.2mm] w-[9.2mm]" />
            <div data-slot="bc-price" className="mx-auto w-fit text-center text-[3mm] leading-none font-bold tabular-nums">{priceText}</div>
          </div>
        </div>
      ) : type === 'ean' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div data-slot="bc-title" className="truncate text-[2.3mm] leading-tight font-semibold">{item.name || '—'}</div>
          <div className="mx-auto" style={{ width: `${LABEL_SPEC.labelWidthMm * 0.9}mm` }}>
            <Ean13Svg code={item.code} className="h-[10mm] w-full" />
          </div>
          <div className="flex items-center justify-between gap-[1mm] text-[2.4mm] leading-none">
            <span data-slot="bc-price" className="font-bold tabular-nums">{priceText}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div data-slot="bc-title" className="truncate text-[2.3mm] leading-tight font-semibold">{item.name || '—'}</div>
            <Ean13Svg code={item.code} className="h-[8mm] w-full" />
            <div className="flex items-center justify-between gap-[1mm] text-[2.4mm] leading-none">
              <span data-slot="bc-price" className="font-bold tabular-nums">{priceText}</span>
            </div>
          </div>
          <QrSvg text={item.qrText || item.code} className="h-[8.5mm] w-[8.5mm] shrink-0" />
        </>
      )}
    </div>
  )
}

/** ฉลากเดี่ยว 1 ดวง (ใช้ใน preview คอลัมน์ขวา) */
export function SingleLabel({ item }: { item: LabelItem }) {
  return <Label item={item} slot="bc-label-single" />
}

/**
 * แผ่นฉลาก — จัด 3 ดวง/แถว (gap 2 mm) บนกระดาษกว้าง 10.9 cm
 *  - บนจอ: กว้างจริง 109 mm แต่ถ้าจอเล็กกว่าจะเลื่อนแนวนอนได้ (ไม่ทำให้หน้าเว็บล้น)
 *  - ตอนพิมพ์: ใช้ @page ขนาด 109 mm × (จำนวนแถว) และซ่อนทุกอย่างที่ไม่ใช่แผ่นฉลาก
 */
export function LabelSheet({ items, className }: { items: LabelItem[]; className?: string }) {
  const rows = Math.max(1, Math.ceil(items.length / LABEL_SPEC.perRow))
  const pageHeightMm = sheetHeightMm(rows)

  return (
    <div className={`w-full overflow-x-auto ${className || ''}`}>
      <style>{`
        @page { size: ${LABEL_SPEC.paperWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        [data-slot="qr-image"] > svg { width: 100%; height: 100%; display: block; }
        @media print {
          body * { visibility: hidden !important; }
          [data-slot="bc-sheet"], [data-slot="bc-sheet"] * { visibility: visible !important; }
          [data-slot="bc-sheet"] { position: absolute; left: 0; top: 0; }
          [data-slot="bc-cell"] { border-color: transparent !important; }
        }
      `}</style>
      <div
        data-slot="bc-sheet"
        style={{
          width: `${LABEL_SPEC.paperWidthMm}mm`,
          paddingLeft: `${SIDE_MARGIN_MM}mm`,
          paddingRight: `${SIDE_MARGIN_MM}mm`,
          rowGap: `${LABEL_SPEC.gapMm}mm`,
          columnGap: `${LABEL_SPEC.gapMm}mm`,
        }}
        className="flex flex-wrap bg-white"
      >
        {items.map((item, i) => (
          <Label key={i} item={item} slot="bc-cell" />
        ))}
      </div>
    </div>
  )
}
