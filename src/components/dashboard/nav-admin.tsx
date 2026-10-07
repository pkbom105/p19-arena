'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Dumbbell, ScanBarcode, Settings as SettingsIcon, ShoppingCart, Store, Tags } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ACCOUNT_NAV, SECTIONS, type SectionId } from './helpers'

interface NavAdminProps {
  /** แท็บที่กำลังเปิด — ไม่ส่งมาก็ได้ (ใช้กับหน้าที่แยกออกมาเป็นของตัวเอง) */
  section?: SectionId
  onSelect: (id: SectionId) => void
}

/** Side menu (desktop) — Level 1 Admin: แสดงเมนูครบทุกตัว (all menu) */
export function NavAdmin({ section, onSelect }: NavAdminProps) {
  const pathname = usePathname()

  /** ปุ่มเมนู 1 รายการ (แท็บในหน้า Dashboard) */
  const renderItem = ({ id, label, icon: Icon }: (typeof SECTIONS)[number]) => {
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
  }

  /** ลิงก์เมนูของหน้าที่แยกเป็นของตัวเอง (กลุ่ม ACCOUNT) — ไป URL จริง */
  const renderLink = ({ label, icon: Icon, href }: (typeof ACCOUNT_NAV)[number]) => {
    const active = pathname === href
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          active ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    )
  }

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
      {/* DASHBOARD — แท็บที่สลับด้วย state ในหน้า /dashboard/1 */}
      {SECTIONS.map(renderItem)}

      {/* กลุ่ม ACCOUNT — เมนูที่แยกเป็นหน้าของตัวเอง (ลิงก์จริง) */}
      <Separator className="my-2" />
      <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">ACCOUNT</div>
      {ACCOUNT_NAV.map(renderLink)}
    </aside>
  )
}