'use client'

import Link from 'next/link'
import { BarChart3, Dumbbell, ScanBarcode, Settings as SettingsIcon, ShoppingCart, Store, Tags } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { SECTIONS, type SectionId } from './helpers'

interface NavAdminProps {
  section: SectionId
  onSelect: (id: SectionId) => void
}

/** Side menu (desktop) — Level 1 Admin: แสดงเมนูครบทุกตัว (all menu) */
export function NavAdmin({ section, onSelect }: NavAdminProps) {
  return (
    <aside className="w-56 shrink-0 bg-white border-r hidden lg:flex flex-col gap-1 px-3 py-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        <Dumbbell className="h-4 w-4" /> Home / Booking
      </Link>
      <Link
        href="/dashboard/shop/pos-booking"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        <Store className="h-4 w-4" /> pos-booking
      </Link>
      <Link
        href="/dashboard/shop/pos-shop"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        <ShoppingCart className="h-4 w-4" /> pos-shop
      </Link>
      <Link
        href="/dashboard/shop-setting"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        <Tags className="h-4 w-4" /> shop-setting
      </Link>
      <Link
        href="/dashboard/shop/shop-report"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        <BarChart3 className="h-4 w-4" /> shop-report
      </Link>
      <Link
        href="/dashboard/barcode"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
      >
        <ScanBarcode className="h-4 w-4" /> barcode
      </Link>
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <SettingsIcon className="h-4 w-4" /> Setting
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