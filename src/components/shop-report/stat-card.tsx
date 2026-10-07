'use client'

import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

/** การ์ดตัวเลขสรุป — ใช้ร่วมกันใน sub-menu ของหน้า /dashboard/shop/shop-report */
export function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="text-emerald-600">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}
