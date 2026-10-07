'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PartyPopper } from 'lucide-react'

/**
 * เมนูย่อยของหน้า /activity/activities — แถบปุ่มอยู่ใต้ ActivityGroupMenu
 * แต่ละรายการมี URL ของตัวเอง และเนื้อหาอยู่ในไฟล์ของแต่ละ sub-menu
 */
const SUB_MENUS = [{ href: '/activity/activities/party-match', label: 'Party Match', icon: PartyPopper }] as const

export function ActivitiesSubMenu() {
  const pathname = usePathname()

  return (
    <nav className="mt-6 grid grid-cols-3 gap-3" aria-label="เมนูย่อยกิจกรรม">
      {SUB_MENUS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              // สีแบบ invert ของปุ่มกลุ่มเมนูด้านบน (พื้นขาว + ตัวอักษรเขียว) และสูงครึ่งหนึ่ง
              'flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors sm:text-sm ' +
              (active
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50')
            }
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
