'use client'

import type { ComponentType } from 'react'

interface StatCardProps {
  label: string
  value: number
  icon: ComponentType<{ className?: string }>
  color?: string
  prefix?: string
}

/** การ์ดสรุปตัวเลข 1 ค่า — ใช้ในหน้า Dashboard → Overview */
export function StatCard({ label, value, icon: Icon, color, prefix }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-background p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className={`h-4 w-4 ${color ?? 'text-muted-foreground'}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-bold ${color ?? ''}`}>
        {prefix}{value.toLocaleString()}
      </div>
    </div>
  )
}
