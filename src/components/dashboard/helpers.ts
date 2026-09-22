'use client'

import {
  CalendarDays, LayoutDashboard, MapPin, MessageCircle, Receipt, Wrench,
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

export const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'court', label: 'Court', icon: MapPin },
  { id: 'equipment', label: 'Equipment', icon: Wrench },
  { id: 'booking', label: 'Booking Tickets', icon: CalendarDays },
  { id: 'slip', label: 'Slip Upload', icon: Receipt },
  { id: 'line', label: 'LINE Credential', icon: MessageCircle },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']
