'use client'

import Link from 'next/link'
import { Dumbbell, Settings as SettingsIcon, Store } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { SECTIONS, type SectionId } from './helpers'

interface DashboardSidebarProps {
  section: SectionId
  onSelect: (id: SectionId) => void
}

/** Side menu (desktop) — ทางเข้าหลัก + สลับ section ของ Dashboard */
export function DashboardSidebar({ section, onSelect }: DashboardSidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-white border-r hidden lg:flex flex-col gap-1 px-3 py-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        <Dumbbell className="h-4 w-4" /> Home / Booking
      </Link>
      <Link
        href="/dashboard/pos"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        <Store className="h-4 w-4" /> POS หน้าเคาน์เตอร์
      </Link>
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <SettingsIcon className="h-4 w-4" /> Settings
      </Link>
      <Separator className="my-2" />
      <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">DASHBOARD</div>
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const active = section === id
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
              (active
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted")
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        )
      })}
    </aside>
  )
}
