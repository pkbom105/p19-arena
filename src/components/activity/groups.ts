import { GraduationCap, Trophy, Users } from 'lucide-react'

/** 3 กลุ่มเมนูในหน้ากิจกรรม — ใช้ร่วมเฉพาะหน้าใต้ /activity (ไฟล์ข้อมูล: import ได้ทั้ง server/client) */
export const ACTIVITY_GROUPS = [
  { href: '/activity/coach', label: 'โค้ช', desc: 'ตารางสอนและโปรไฟล์โค้ช', icon: GraduationCap },
  { href: '/activity/member', label: 'สมาชิก', desc: 'สมัครสมาชิกและสิทธิประโยชน์', icon: Users },
  { href: '/activity/activities', label: 'กิจกรรม', desc: 'ทัวร์นาเมนต์และโปรโมชั่น', icon: Trophy },
] as const

export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]
