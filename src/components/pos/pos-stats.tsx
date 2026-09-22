'use client'

import type { LucideIcon } from 'lucide-react'
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock } from 'lucide-react'
import { formatThaiDate } from './helpers'

function StatCard({ icon: Icon, tone, label, value }: {
  icon: LucideIcon
  tone: string
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-lg border bg-white p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  )
}

/** สรุปสถิติของวันที่เลือก */
export function PosStats({ date, activeCount, pendingCount, confirmedCount, revenue }: {
  date: string
  activeCount: number
  pendingCount: number
  confirmedCount: number
  revenue: number
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard icon={CalendarDays} tone="bg-emerald-100 text-emerald-700" label={`จองวันนี้ (${formatThaiDate(date)})`} value={activeCount} />
      <StatCard icon={Clock} tone="bg-amber-100 text-amber-700" label="รอชำระ" value={pendingCount} />
      <StatCard icon={CheckCircle2} tone="bg-teal-100 text-teal-700" label="ยืนยันแล้ว" value={confirmedCount} />
      <StatCard icon={CircleDollarSign} tone="bg-violet-100 text-violet-700" label="รายได้โดยประมาณ" value={`฿${revenue.toLocaleString()}`} />
    </div>
  )
}
