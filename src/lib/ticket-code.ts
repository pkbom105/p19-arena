/** ตัวอักษรที่ไม่สับสน (ไม่มี O/I) สำหรับรหัสตั๋ว */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_DIGITS = '0123456789'

/**
 * สร้างรหัสตั๋ว: 4 ตัวอักษร + 4 ตัวเลข (8 หลัก เช่น ABCD1234)
 */
export function generateTicketCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  for (let i = 0; i < 4; i++) code += CODE_DIGITS[Math.floor(Math.random() * CODE_DIGITS.length)]
  return code
}