/**
 * บัตรเติมเงิน (Cash Card) — แหล่งความจริงเดียวทั้งฝั่งจอและฝั่งเซิร์ฟเวอร์
 *
 * สำคัญ: **ยอดเงินที่ให้เครดิตต้องคิดจากไฟล์นี้เท่านั้น** ฝั่ง client ส่งมาแค่ `cardId`
 * (ห้ามเชื่อยอดที่ client ส่งมา — กันการแก้ยอดในเบราว์เซอร์)
 */
export interface CashCard {
  id: string
  name: string
  /** ยอดที่ลูกค้าจ่าย (ยอดใน PromptPay QR) */
  pay: number
  /** ยอดที่ได้เข้ากระเป๋า */
  get: number
}

export const CASH_CARDS: CashCard[] = [
  { id: 'card-a', name: 'Cash Card A', pay: 950, get: 1000 },
  { id: 'card-b', name: 'Cash Card B', pay: 1500, get: 1600 },
  { id: 'card-c', name: 'Cash Card C', pay: 1800, get: 2000 },
]

/** หาการ์ดจาก id (คืน null ถ้าไม่มี — ใช้ตรวจฝั่งเซิร์ฟเวอร์) */
export function findCashCard(id: unknown): CashCard | null {
  if (typeof id !== 'string') return null
  return CASH_CARDS.find((card) => card.id === id) ?? null
}
