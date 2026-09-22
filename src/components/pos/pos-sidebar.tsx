'use client'

import Link from 'next/link'
import { Dumbbell, LayoutDashboard, Settings as SettingsIcon, Store } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

/** Side menu (desktop) — โครงเดียวกับหน้า Dashboard */
export function PosSidebar() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r hidden lg:flex flex-col gap-1 px-3 py-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        <Dumbbell className="h-4 w-4" /> หน้าแรก / จองสนาม
      </Link>
      <Separator className="my-2" />
      <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">ADMIN</div>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <LayoutDashboard className="h-4 w-4" /> Dashboard
      </Link>
      <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-emerald-500 text-white shadow-sm">
        <Store className="h-4 w-4" /> POS หน้าเคาน์เตอร์
      </span>
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <SettingsIcon className="h-4 w-4" /> Settings
      </Link>
    </aside>
  )
}

/** Side menu (mobile) */
export function PosMobileNav() {
  return (
    <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 py-2 bg-white border-b">
      <Link href="/" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 whitespace-nowrap">
        <Dumbbell className="h-4 w-4" /> หน้าแรก
      </Link>
      <Link href="/dashboard" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted whitespace-nowrap">
        <LayoutDashboard className="h-4 w-4" /> Dashboard
      </Link>
      <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-500 text-white whitespace-nowrap">
        <Store className="h-4 w-4" /> POS
      </span>
      <Link href="/settings" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted whitespace-nowrap">
        <SettingsIcon className="h-4 w-4" /> Settings
      </Link>
    </nav>
  )
}
