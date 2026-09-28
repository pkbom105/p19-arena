'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ACTIVITY_GROUPS } from './groups'

/** กลุ่มเมนู 3 การ์ด (โค้ช / สมาชิก / กิจกรรม) */
export function ActivityGroupMenu() {
  const pathname = usePathname()

  return (
    <nav className="grid grid-cols-3 gap-3" aria-label="เมนูกิจกรรม">
      {ACTIVITY_GROUPS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 font-medium transition-colors ' +
              (active
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')
            }
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs sm:text-sm">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
