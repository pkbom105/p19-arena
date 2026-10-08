'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ticket, UserRound, Wallet } from 'lucide-react'
import { BASE_PATH } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * เมนูย่อยของพื้นที่สมาชิก (Profile) — 3 แท็บที่มี **URL ของตัวเอง**
 * `/member/profile` (ตั๋ว · ค่าเริ่มต้น) · `/member/profile/wallet` (กระเป๋าเงิน) · `/member/profile/user` (ผู้ใช้)
 * สไตล์เหมือนแถบแท็บเดิม แต่เป็นลิงก์จริง (bookmark/กด back ได้) และไฮไลต์ตาม pathname
 */
const SUB_MENUS = [
  { href: `${BASE_PATH}/member/profile`, label: 'ตั๋ว', icon: Ticket },
  { href: `${BASE_PATH}/member/profile/wallet`, label: 'กระเป๋าเงิน', icon: Wallet },
  { href: `${BASE_PATH}/member/profile/user`, label: 'ผู้ใช้', icon: UserRound },
] as const

export function MemberProfileMenu() {
  const pathname = usePathname()

  return (
    <nav
      className="mt-6 grid w-full grid-cols-3 gap-[3px] rounded-lg bg-muted p-[3px]"
      aria-label="เมนูโปรไฟล์สมาชิก"
    >
      {SUB_MENUS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors',
              active ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
