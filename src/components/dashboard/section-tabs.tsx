'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, MapPin, MessageCircle, PartyPopper, Receipt, Trophy } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ACCOUNT_NAV } from './helpers'

/**
 * คลาสร่วมของแต่ละช่องในแท็บบาร์มือถือ — จัดใหม่เป็น 2 แถว (4 คอลัมน์ × 2 แถว)
 * แต่ละช่องวางไอคอนบน-ป้ายล่าง และให้ป้ายตัดบรรทัดได้ (whitespace-normal + text-xs)
 * เพื่อไม่ให้ข้อความล้น/ทับกันที่จอ 390px
 */
const TAB_CELL_CLASS =
  'flex h-auto flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-1 py-1.5 text-xs font-medium leading-tight whitespace-normal text-center transition-[color,box-shadow]'

/** คลาสเดียวกับแท็บในมือถือ — ใช้กับเมนูที่เป็นลิงก์จริง (หน้าที่แยกออกมา) */
const TAB_LINK_CLASS = `${TAB_CELL_CLASS} text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`

/** แถบแท็บแนวนอน — แสดงเฉพาะจอเล็ก (เดสก์ท็อปใช้ Sidebar แทน) */
export function SectionTabs() {
  const pathname = usePathname()

  return (
    <TabsList className="w-full lg:hidden mb-4 grid grid-cols-4 gap-1 h-auto items-stretch">
      <TabsTrigger value="court" className={TAB_CELL_CLASS}>
        <MapPin className="h-4 w-4" /> <span className="font-medium">Court</span>
      </TabsTrigger>
      <TabsTrigger value="party-match" className={TAB_CELL_CLASS}>
        <PartyPopper className="h-4 w-4" /> <span className="font-medium">Party Match</span>
      </TabsTrigger>
      <TabsTrigger value="booking" className={TAB_CELL_CLASS}>
        <Clock className="h-4 w-4" /> <span className="font-medium">Tickets</span>
      </TabsTrigger>
      <TabsTrigger value="slip" className={TAB_CELL_CLASS}>
        <Receipt className="h-4 w-4" /> <span className="font-medium">Slip</span>
      </TabsTrigger>
      <TabsTrigger value="activity" className={TAB_CELL_CLASS}>
        <Trophy className="h-4 w-4" /> <span className="font-medium">กิจกรรม</span>
      </TabsTrigger>
      <TabsTrigger value="line" className={TAB_CELL_CLASS}>
        <MessageCircle className="h-4 w-4" /> <span className="font-medium">LINE</span>
      </TabsTrigger>
      {/* เมนูที่แยกเป็นหน้าของตัวเอง (กลุ่ม ACCOUNT) — เป็นลิงก์จริง */}
      {ACCOUNT_NAV.map(({ label, icon: Icon, href }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={cn(TAB_LINK_CLASS, pathname === href && 'bg-background shadow-sm')}
        >
          <Icon className="h-4 w-4" /> <span className="font-medium">{label}</span>
        </Link>
      ))}
    </TabsList>
  )
}
