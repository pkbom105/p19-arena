'use client'

import Link from 'next/link'
import { BarChart3, Dumbbell, LayoutDashboard, ScanBarcode, Settings as SettingsIcon, ShoppingCart, Store, Tags } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export type PosNavId = 'pos-booking' | 'pos-shop' | 'shop-setting' | 'shop-report' | 'barcode'

/** เมนู ADMIN ของกลุ่มหน้า POS (เรียงตามที่แสดงบนจอ) */
const POS_NAV = [
  { id: 'pos-booking', href: '/dashboard/shop/pos-booking', label: 'pos-booking', icon: Store },
  { id: 'pos-shop', href: '/dashboard/shop/pos-shop', label: 'pos-shop', icon: ShoppingCart },
  { id: 'shop-setting', href: '/dashboard/shop-setting', label: 'shop-setting', icon: Tags },
  { id: 'shop-report', href: '/dashboard/shop/shop-report', label: 'shop-report', icon: BarChart3 },
  // เมนูบาร์โค้ด — อยู่ต่อจาก shop-report (หน้า /dashboard/barcode)
  { id: 'barcode', href: '/dashboard/barcode', label: 'barcode', icon: ScanBarcode },
] as const

/** 3 หน้า Shop (Level 2) — ใช้เมื่อต้องการแสดงเฉพาะ 3 เมนูนี้ */
const SHOP_NAV = POS_NAV.filter((n) => n.id === 'pos-booking' || n.id === 'pos-shop' || n.id === 'shop-report')

/** Side menu (desktop) — โครงเดียวกับหน้า Dashboard */
export function PosSidebar({ active = 'pos-booking', shopOnly = false }: { active?: PosNavId; shopOnly?: boolean }) {
  const nav = shopOnly ? SHOP_NAV : POS_NAV
  return (
    <aside className="w-56 shrink-0 bg-white border-r hidden lg:flex flex-col gap-1 px-3 py-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      {shopOnly ? (
        <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">SHOP</div>
      ) : (
        <>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <Dumbbell className="h-4 w-4" /> หน้าแรก / จองสนาม
          </Link>
          <Separator className="my-2" />
          <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">ADMIN</div>
          <Link
            href="/dashboard/1"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        </>
      )}
      {nav.map(({ id, href, label, icon: Icon }) =>
        active === id ? (
          <span key={id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-emerald-500 text-white shadow-sm">
            <Icon className="h-4 w-4" /> {label}
          </span>
        ) : (
          <Link
            key={id}
            href={href}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        )
      )}
      {!shopOnly && (
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          <SettingsIcon className="h-4 w-4" /> Settings
        </Link>
      )}
    </aside>
  )
}

/** Side menu (mobile) */
export function PosMobileNav({ active = 'pos-booking', shopOnly = false }: { active?: PosNavId; shopOnly?: boolean }) {
  const nav = shopOnly ? SHOP_NAV : POS_NAV
  return (
    <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 py-2 bg-white border-b">
      {!shopOnly && (
        <>
          <Link href="/" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 whitespace-nowrap">
            <Dumbbell className="h-4 w-4" /> หน้าแรก
          </Link>
          <Link href="/dashboard/1" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted whitespace-nowrap">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        </>
      )}
      {nav.map(({ id, href, label, icon: Icon }) =>
        active === id ? (
          <span key={id} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-500 text-white whitespace-nowrap">
            <Icon className="h-4 w-4" /> {label}
          </span>
        ) : (
          <Link key={id} href={href} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted whitespace-nowrap">
            <Icon className="h-4 w-4" /> {label}
          </Link>
        )
      )}
      {!shopOnly && (
        <Link href="/settings" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted whitespace-nowrap">
          <SettingsIcon className="h-4 w-4" /> Settings
        </Link>
      )}
    </nav>
  )
}

