import Link from 'next/link'
import { ArrowLeft, Store } from 'lucide-react'
import { NavShop, SHOP_NAV } from '@/components/dashboard/nav-shop'

export const metadata = { title: 'Shop — P19 Arena' }

/** /dashboard/shop → Dashboard เลือก 3 หน้า Shop (Level 2) — side menu 3 ตัว (NavShop) + การ์ด 3 สี */
export default function ShopPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link
            href="/dashboard/1"
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="กลับ Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Store className="h-6 w-6 text-emerald-600" />
          <h1 className="font-bold text-lg">Shop</h1>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Side menu (desktop) — Level 2 Shop */}
        <NavShop />

        <main className="flex-1 min-w-0 px-4 py-10">
          <p className="text-sm text-muted-foreground mb-4">Level 2 — Shop</p>
          <nav className="grid grid-cols-3 gap-3" aria-label="เมนู Shop">
            {SHOP_NAV.map(({ href, title, desc, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl ${color} text-white hover:opacity-90 px-2 py-8 transition-opacity`}
              >
                <Icon className="h-8 w-8" />
                <span className="font-semibold text-sm text-center leading-tight">{title}</span>
                <span className="text-xs text-white/80 text-center leading-tight">{desc}</span>
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </div>
  )
}

