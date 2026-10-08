'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Phone, CalendarPlus, Search, Users, LayoutDashboard } from 'lucide-react'
import { MemberLogoutButton } from '@/components/member/member-logout-button'
import { apiUrl } from '@/lib/api'

/** หน้าพื้นที่สมาชิก (hub) — ยังไม่ล็อกอินจะเจอบล็อกล็อกอินก่อน */
const MEMBER_HREF = '/member'
/** หน้าโปรไฟล์สมาชิก — ใช้เมื่อเช็คแล้วว่าล็อกอินอยู่ (กดเมนู Member แล้วเข้าโปรไฟล์เลย) */
const MEMBER_PROFILE_HREF = '/member/profile'

const MENU_ITEMS = [
  { href: '/', label: 'จองสนาม', icon: CalendarPlus },
  { href: '/check', label: 'ตรวจสอบการจอง', icon: Search },
  { href: MEMBER_HREF, label: 'Member', icon: Users },
]

/**
 * Header ร่วม: โลโก้ + เมนูหลัก (จองสนาม / ตรวจสอบการจอง / Member) + ออกจากระบบ/ติดต่อเรา
 * @param showLogout แสดงปุ่มออกจากระบบ (default true)
 */
export function SiteHeader({ showLogout = true }: { showLogout?: boolean } = {}) {
  const pathname = usePathname()
  /** ล็อกอินอยู่หรือไม่ — ใช้เลือกปลายทางของเมนู Member (ล็อกอินแล้ว → โปรไฟล์เลย) */
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/wallet/session'), { cache: 'no-store' })
      .then((response) => {
        if (!cancelled && response.ok) setAuthenticated(true)
      })
      .catch(() => {
        // ยังไม่ล็อกอิน / เน็ตมีปัญหา — คงปลายทางเดิม (หน้า hub ที่มีบล็อกล็อกอิน)
      })
    return () => { cancelled = true }
  }, [])

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
              href="/dashboard/1"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Dashboard"
            >
              <LayoutDashboard className="h-4 w-4" />
            </Link>
            {showLogout && <MemberLogoutButton />}
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
            // เมนู Member: ล็อกอินอยู่ → เข้าโปรไฟล์เลย · ยังไม่ล็อกอิน → เข้า hub (เจอบล็อกล็อกอินก่อน)
            const target = href === MEMBER_HREF && authenticated ? MEMBER_PROFILE_HREF : href
            const active = pathname === target
            return (
              <Link
                key={href}
                href={target}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex flex-1 h-36 flex-col items-center justify-center gap-2 rounded-xl px-2 font-medium transition-colors ' +
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