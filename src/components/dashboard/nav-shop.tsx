import Link from 'next/link'
import { ArrowLeft, BarChart3, ShoppingCart, Store } from 'lucide-react'

/** รายการเมนู Shop (Level 2) — ใช้ทั้ง side menu และการ์ดบนหน้า /dashboard/shop */
export const SHOP_NAV = [
  { href: '/dashboard/shop/pos-booking', label: 'pos-booking', title: 'Pos-Booking', desc: 'เคาน์เตอร์จอง', icon: Store, color: 'bg-emerald-500' },
  { href: '/dashboard/shop/pos-shop', label: 'pos-shop', title: 'Pos-Shop', desc: 'แคชเชียร์ขายสินค้า', icon: ShoppingCart, color: 'bg-sky-500' },
  { href: '/dashboard/shop/shop-report', label: 'shop-report', title: 'Shop-Report', desc: 'รายงานร้าน', icon: BarChart3, color: 'bg-violet-500' },
] as const

/** Side menu (desktop) — Level 2 Shop: 3 หน้า (pos-booking / pos-shop / shop-report) */
export function NavShop() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r hidden lg:flex flex-col gap-1 px-3 py-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <Link
        href="/dashboard/1"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      {SHOP_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </aside>
  )
}