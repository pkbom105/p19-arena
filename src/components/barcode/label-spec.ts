/**
 * สเปกกระดาษฉลาก (ม้วน) — แหล่งความจริงเดียวของหน้าบาร์โค้ด + ใช้คำนวณ layout พิมพ์
 *  - ฉลาก 3.4 × 2.0 cm · 3 ดวง/แถว · gap 2 mm · กระดาษกว้าง 10.9 cm · ม้วน core 1.5 นิ้ว
 *  - รุ่น: FGS 3.4x2 · part no. PMC-SG-3D12-01
 */
export const LABEL_SPEC = {
  labelWidthMm: 34,
  labelHeightMm: 20,
  perRow: 3,
  gapMm: 2,
  paperWidthMm: 109,
  coreInch: 1.5,
  model: 'FGS 3.4x2',
  partNo: 'PMC-SG-3D12-01',
} as const

/** ความกว้างรวมของ 3 ดวง + gap = 34×3 + 2×2 = 106 mm */
export const ROW_WIDTH_MM = LABEL_SPEC.perRow * LABEL_SPEC.labelWidthMm + (LABEL_SPEC.perRow - 1) * LABEL_SPEC.gapMm
/** margin ซ้าย/ขวา = (109 − 106) / 2 = 1.5 mm */
export const SIDE_MARGIN_MM = (LABEL_SPEC.paperWidthMm - ROW_WIDTH_MM) / 2

/** ความสูงกระดาษที่ต้องใช้เมื่อพิมพ์ `rows` แถว (มี gap ระหว่างแถวเท่ากับ gapMm) */
export const sheetHeightMm = (rows: number) =>
  rows * LABEL_SPEC.labelHeightMm + Math.max(0, rows - 1) * LABEL_SPEC.gapMm

/** ค่าที่แสดงให้ผู้ใช้เห็นบนหน้าเว็บ */
export const LABEL_SPEC_TEXT = `${LABEL_SPEC.labelWidthMm / 10} × ${LABEL_SPEC.labelHeightMm / 10} cm · ${LABEL_SPEC.perRow} ดวง/แถว · gap ${LABEL_SPEC.gapMm} mm · กระดาษกว้าง ${LABEL_SPEC.paperWidthMm / 10} cm · ม้วน core ${LABEL_SPEC.coreInch}″ · ${LABEL_SPEC.model} (${LABEL_SPEC.partNo})`
