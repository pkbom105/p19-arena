import { GraduationCap, IdCard, Trophy } from 'lucide-react'

/** 3 กลุ่มเมนูย่อยของพื้นที่สมาชิก (/member) — ใช้ร่วมทุกหน้าใต้ /member (ไฟล์ข้อมูล: import ได้ทั้ง server/client) */
export const ACTIVITY_GROUPS = [
  { href: '/member/profile', label: 'Profile', desc: 'โปรไฟล์ที่เข้าสู่ระบบและกระเป๋าเงิน', icon: IdCard },
  { href: '/member/activities', label: 'กิจกรรม', desc: 'ทัวร์นาเมนต์และโปรโมชั่น', icon: Trophy },
  { href: '/member/coach', label: 'โค้ช', desc: 'ตารางสอนและโปรไฟล์โค้ช', icon: GraduationCap },
] as const

export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]
