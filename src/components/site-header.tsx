'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Phone, Settings, CalendarPlus, Search, LayoutDashboard } from 'lucide-react'

const MENU_ITEMS = [
  { href: '/', label: 'จองสนาม', icon: CalendarPlus },
  { href: '/check', label: 'ตรวจสอบการจอง', icon: Search },
]

/** Header ร่วม: โลโก้ + เมนูหลัก (จองสนาม / ตรวจสอบการจอง) + ตั้งค่า/ติดต่อเรา */
export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">P19 Pickleball Arena</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">จองสนามออนไลน์</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Dashboard"
            >
              <LayoutDashboard className="h-4 w-4" />
            </Link>
            <Link
              href="/settings"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="ตั้งค่า"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <a
              href="tel:02-xxx-xxxx"
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">ติดต่อเรา</span>
            </a>
          </div>
        </div>

        {/* เมนูหลัก */}
        <nav className="flex gap-3 mt-3" aria-label="เมนูหลัก">
          {MENU_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex flex-1 h-36 flex-col items-center justify-center gap-2 rounded-xl px-3 font-medium transition-colors ' +
                  (active
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')
                }
              >
                <Icon className="h-7 w-7" />
                <span className="text-base">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}