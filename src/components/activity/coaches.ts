/**
 * ข้อมูลโค้ช (mockup) — หน้า /activity/coach
 * ไฟล์ข้อมูลล้วน (ไม่มี 'use client') เพื่อให้ import ได้ทั้ง server/client component
 */

export interface CoachPackage {
  id: string
  name: string
  /** ตัวอักษรย่อสำหรับวงกลม avatar */
  initial: string
  level: string
  /** ราคาต่อชั่วโมง (บาท) */
  pricePerHour: number
  experienceYears: number
  specialties: string[]
  /** วัน/เวลาที่ว่าง (ข้อความตัวอย่าง) */
  availableDays: string
  rating: number
}

/** โค้ช 2 ท่าน — 600 บาท/ชม. และ 800 บาท/ชม. (ข้อมูลตัวอย่าง) */
export const COACH_PACKAGES: CoachPackage[] = [
  {
    id: 'coach-ton',
    name: 'โค้ชต้น (Coach Ton)',
    initial: 'ต',
    level: 'ระดับกลาง',
    pricePerHour: 600,
    experienceYears: 5,
    specialties: ['พื้นฐานไม้', 'ฟุตเวิร์ก', 'เสิร์ฟ'],
    availableDays: 'จ.–ศ. 17:00–21:00',
    rating: 4.8,
  },
  {
    id: 'coach-may',
    name: 'โค้ชเมย์ (Coach May)',
    initial: 'ม',
    level: 'ระดับโปร',
    pricePerHour: 800,
    experienceYears: 8,
    specialties: ['แท็กติกคู่', 'ลูกสั้น/ดิงก์', 'ซ้อมแข่งจริง'],
    availableDays: 'ส.–อา. 09:00–18:00',
    rating: 4.9,
  },
]

/** ช่วงเวลาจองโค้ช (mockup) — ช่วงละ 1 ชั่วโมง */
export const COACH_SLOT_TIMES = [
  '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
] as const

/** จำนวนวันล่วงหน้าที่ให้เลือก (วันนี้ + อีก 6 วัน) */
export const COACH_ADVANCE_DAYS = 6
