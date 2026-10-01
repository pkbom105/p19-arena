/**
 * EAN-13 encoder — เขียนเอง ไม่ใช้ไลบรารีภายนอก
 * โครงสร้าง 95 โมดูล: 101 (guard) + 6 หลักซ้าย (7 โมดูล/หลัก) + 01010 (center) + 6 หลักขวา + 101 (guard)
 * parity ของหลักซ้าย (L/G) กำหนดด้วยหลักแรก (0-9) — '1' = แท่งดำ
 */

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
/** parity ของ 6 หลักซ้าย สำหรับหลักแรก 0-9 */
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export const EAN13_MODULES = 95
/** ตำแหน่งโมดูลของ guard (ใช้วาดแท่งยื่นยาวกว่าปกติ) */
export const EAN13_GUARDS: [number, number][] = [[0, 3], [45, 50], [92, 95]]

/** คำนวณ check digit จาก 12 หลักแรก */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error('ต้องเป็นตัวเลข 12 หลัก')
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

/**
 * ทำความสะอาด/ตรวจรหัส: รับ 12 หลัก (เติม check digit ให้) หรือ 13 หลัก (ตรวจ check digit)
 */
export function normalizeEan13(input: string): { ok: boolean; code: string; error?: string } {
  const digits = (input || '').replace(/\D/g, '')
  if (digits.length === 12) {
    return { ok: true, code: digits + ean13CheckDigit(digits) }
  }
  if (digits.length === 13) {
    const expected = ean13CheckDigit(digits.slice(0, 12))
    if (Number(digits[12]) !== expected) {
      return { ok: false, code: digits, error: `check digit ไม่ถูกต้อง (ควรเป็น ${expected})` }
    }
    return { ok: true, code: digits }
  }
  return { ok: false, code: '', error: 'ต้องเป็นตัวเลข 12 หรือ 13 หลัก' }
}

/** แปลงรหัส 13 หลัก → สตริง 95 โมดูล ('1' = แท่งดำ) */
export function encodeEan13(code13: string): string {
  if (!/^\d{13}$/.test(code13)) throw new Error('EAN-13 ต้องเป็นตัวเลข 13 หลัก')
  const parity = PARITY[Number(code13[0])]
  let bits = '101'
  for (let i = 0; i < 6; i++) {
    const d = Number(code13[i + 1])
    bits += parity[i] === 'L' ? L[d] : G[d]
  }
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += R[Number(code13[i + 7])]
  bits += '101'
  return bits
}

/** รวมโมดูล '1' ที่ติดกันเป็นแท่งเดียว (run-length) สำหรับวาด SVG */
export function modulesToRuns(bits: string): { x: number; width: number; guard: boolean }[] {
  const runs: { x: number; width: number; guard: boolean }[] = []
  let i = 0
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i
      while (j < bits.length && bits[j] === '1') j++
      const guard = EAN13_GUARDS.some(([a, b]) => i >= a && j <= b)
      runs.push({ x: i, width: j - i, guard })
      i = j
    } else i++
  }
  return runs
}

/**
 * สุ่มบาร์โค้ด EAN-13 ใหม่: prefix (3 หลัก, ค่าเริ่มต้น '885') + เลขสุ่ม 9 หลัก + check digit
 * - ตรวจไม่ให้ซ้ำกับ `existing` (บาร์โค้ดที่มีอยู่ในระบบ)
 * - ถ้า prefix ไม่ครบ 3 หลัก จะเติม 0 ไว้ด้านหน้า
 */
export function generateEan13(existing: readonly string[] = [], prefix = '885'): string {
  const p = (prefix || '').replace(/\D/g, '').slice(0, 3).padStart(3, '0')
  const used = new Set(existing.map((c) => (c || '').replace(/\D/g, '')).filter(Boolean))
  const rand9 = () => Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  for (let i = 0; i < 500; i++) {
    const body = p + rand9()
    const code = body + ean13CheckDigit(body)
    if (!used.has(code)) return code
  }
  // fallback: สุ่มจุดเริ่มแล้วกวาดต่อเนื่องจนเจอเลขที่ยังไม่ถูกใช้
  let n = Math.floor(Math.random() * 1e9)
  for (let i = 0; i < 1_000_000; i++) {
    const body = p + String(n).padStart(9, '0')
    n = (n + 1) % 1e9
    const code = body + ean13CheckDigit(body)
    if (!used.has(code)) return code
  }
  throw new Error('สร้างบาร์โค้ดใหม่ไม่สำเร็จ (เลขฐานเต็ม)')
}
