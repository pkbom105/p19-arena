/**
 * ตัวช่วยวันที่ภาษาไทย (พ.ศ.) ที่ใช้ร่วมกันหลายหน้า — เดิมนิยามซ้ำใน 8+ ไฟล์
 */

/** ชื่อเดือนไทยแบบย่อ (ม.ค. ...) */
export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** ชื่อวันไทยแบบเต็ม (อาทิตย์ ...) */
export const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

/** ชื่อวันไทยแบบย่อมีจุด (อา. จ. ...) */
export const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

/** ชื่อวันไทยแบบสั้นสุดไม่มีจุด (อา จ ...) — ใช้บนจอแคบ */
export const THAI_DAYS_NARROW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const parseDate = (dateStr: string) => new Date(dateStr + 'T00:00:00')

/** "2026-09-16" -> "16 ก.ย. 2569" (ไม่มีชื่อวัน) */
export function formatThaiDate(dateStr: string): string {
  const d = parseDate(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** "2026-09-16" -> "อ. 16 ก.ย. 2569" (มีชื่อวันแบบย่อ) */
export function formatThaiDateWithDay(dateStr: string): string {
  const d = parseDate(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${THAI_DAYS_SHORT[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** "2026-09-16" -> "อังคาร 16 ก.ย. 2569" (มีชื่อวันแบบเต็ม) */
export function formatThaiDateFullDay(dateStr: string): string {
  const d = parseDate(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

