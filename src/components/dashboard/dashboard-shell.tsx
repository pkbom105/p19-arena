'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BASE_PATH } from '@/lib/api'
import { Tabs } from '@/components/ui/tabs'
import { DashboardHeader } from './dashboard-header'
import { NavAdmin } from './nav-admin'
import { SectionTabs } from './section-tabs'
import type { SectionId } from './helpers'

/** LINE OA เริ่มต้นของสาขา (ใช้เมื่อหน้าไหนไม่ได้ส่ง oaManagerChatUrl มา เช่นหน้า Top Up) */
const DEFAULT_OA_BASIC_ID = '@323xcbvy'

interface DashboardShellProps {
  /** แท็บที่กำลังเปิดอยู่ — หน้าที่แยกออกมาเป็นของตัวเองไม่ต้องส่ง */
  section?: SectionId
  /** URL เปิดแชท LINE OA ของผู้ดูแล (ปุ่มบน header) */
  oaManagerChatUrl?: string
  /** วิธีสลับเมนู — ไม่ส่งมาจะนำทางไป URL จริงของแท็บนั้น (router.push) */
  onSelect?: (id: SectionId) => void
  /** แสดงแถบแท็บมือถือ (ใช้กับหน้าที่แยกออกมา เพื่อยังไปหน้าอื่นได้) */
  mobileTabs?: boolean
  children: ReactNode
}

/**
 * โครงหน้าเดียวของ Dashboard Level 1 (header + side menu + main)
 * ใช้ทั้งหน้าแท็บ /dashboard/1/<tab> และหน้าที่แยกเป็นของตัวเอง (/dashboard/1/account, /dashboard/1/topup)
 */
export function DashboardShell({ section, oaManagerChatUrl, onSelect, mobileTabs = false, children }: DashboardShellProps) {
  const router = useRouter()
  const go = onSelect ?? ((id: SectionId) => router.push(`${BASE_PATH}/dashboard/1/${id}`))
  const chatUrl = oaManagerChatUrl ?? `https://manager.line.biz/account/@${DEFAULT_OA_BASIC_ID.replace(/^@/, '')}/chat`

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <DashboardHeader oaManagerChatUrl={chatUrl} />

      <div className="flex flex-1">
        <NavAdmin section={section} onSelect={go} />

        <main className="flex-1 min-w-0 px-4 py-5 lg:pl-4">
          {mobileTabs ? (
            <Tabs value={section ?? ''} onValueChange={(v) => go(v as SectionId)} className="w-full">
              <SectionTabs />
              {children}
            </Tabs>
          ) : (
            children
          )}
        </main>
      </div>

      <div className="pb-8" />
    </div>
  )
}