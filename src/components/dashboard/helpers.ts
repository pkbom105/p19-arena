'use client'

import {
  CalendarDays, MapPin, MessageCircle, PartyPopper, Receipt, Trophy, User, Wallet,
} from 'lucide-react'

export const DAY_OPTIONS = [
  { value: '0', label: 'อาทิตย์' },
  { value: '1', label: 'จันทร์' },
  { value: '2', label: 'อังคาร' },
  { value: '3', label: 'พุธ' },
  { value: '4', label: 'พฤหัสบดี' },
  { value: '5', label: 'ศุกร์' },
  { value: '6', label: 'เสาร์' },
]

/** แสดงชื่อวัน จาก string "0,1,6" -> "อาทิตย์, จันทร์, เสาร์" ; ว่าง -> "ทุกวัน" */
export function formatDays(days: string | null): string {
  if (!days || days.trim() === '') return 'ทุกวัน'
  return days
    .split(',')
    .map((d) => DAY_OPTIONS[Number(d)]?.label)
    .filter(Boolean)
    .join(', ')
}

export const COURT_COLORS = [
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
]
export const COURT_ICONS = ['1', '2', '3', '4', '5', '6']

/** แท็บภายใน Dashboard ที่สลับด้วย state (หน้าอื่นมีไฟล์ page.tsx ของตัวเอง) */
export const SECTIONS = [
  { id: 'court', label: 'Court', icon: MapPin },
  { id: 'party-match', label: 'Party Match', icon: PartyPopper },
  { id: 'booking', label: 'Booking ticket', icon: CalendarDays },
  { id: 'slip', label: 'Slip update', icon: Receipt },
  { id: 'activity', label: 'กิจกรรม', icon: Trophy },
  { id: 'line', label: 'Line credential', icon: MessageCircle },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

/**
 * เมนูกลุ่ม ACCOUNT — แยกเป็น **หน้าของตัวเอง** (URL จริง) ไม่ได้สลับด้วย state เหมือน SECTIONS
 * เรียงตามที่แสดงใน side menu (ต่อจากกลุ่ม DASHBOARD) — href ไม่ต้องใส่ BASE_PATH เพราะ <Link> เติมให้
 */
export const ACCOUNT_NAV = [
  { id: 'account', label: 'User', icon: User, href: '/dashboard/1/account' },
  { id: 'topup', label: 'Top up', icon: Wallet, href: '/dashboard/1/topup' },
] as const
