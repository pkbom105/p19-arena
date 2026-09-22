'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatThaiDate } from './helpers'

/** Top bar — กลับ Dashboard, ชื่อหน้า, วันที่ที่เลือก, รีเฟรช */
export function PosHeader({ date, refreshing, onRefresh }: {
  date: string
  refreshing: boolean
  onRefresh: () => void
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="flex items-center gap-2 px-4 h-14">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push('/dashboard')} aria-label="กลับ Dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Store className="h-6 w-6 text-emerald-600 shrink-0" />
        <h1 className="font-bold text-lg whitespace-nowrap">POS หน้าเคาน์เตอร์</h1>
        <Badge variant="secondary" className="text-xs hidden md:inline-flex">{formatThaiDate(date)}</Badge>

        <Button variant="outline" size="icon" className="h-8 w-8 ml-auto" onClick={onRefresh} disabled={refreshing} aria-label="รีเฟรช">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </header>
  )
}
