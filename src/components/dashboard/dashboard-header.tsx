'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, LayoutDashboard, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  oaManagerChatUrl: string
}

/** แถบด้านบนของ Dashboard — ปุ่มย้อนกลับ, ชื่อหน้า, ปุ่มเปิดแชท LINE OA, ป้าย Admin */
export function DashboardHeader({ oaManagerChatUrl }: DashboardHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="flex items-center gap-3 px-4 h-14">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <LayoutDashboard className="h-6 w-6 text-emerald-600" />
        <h1 className="font-bold text-lg">Dashboard — P19 Arena</h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={() => window.open(oaManagerChatUrl, '_blank', 'noopener,noreferrer')}
          title="เปิดหน้าจอแชท LINE Official Account Manager"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          แชท LINE
        </Button>
        <Badge variant="secondary" className="text-xs">Admin</Badge>
      </div>
    </header>
  )
}
