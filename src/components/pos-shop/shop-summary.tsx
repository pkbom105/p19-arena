'use client'

import type { LucideIcon } from 'lucide-react'
import { CircleDollarSign, Package, Receipt, TrendingUp } from 'lucide-react'
import { formatTHB } from './catalog'

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

/** สรุปยอดขายด้านบนสุดของหน้า — นับจากบิลในรอบการใช้งานนี้ (ยังไม่บันทึก DB) */
export function ShopSummary({ totalSales, billCount, soldItems, avgPerBill }: {
  totalSales: number
  billCount: number
  soldItems: number
  avgPerBill: number
}) {
  return (
    <section className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={CircleDollarSign} tone="bg-emerald-100 text-emerald-700" label="ยอดขาย (รอบนี้)" value={formatTHB(totalSales)} />
        <StatCard icon={Receipt} tone="bg-sky-100 text-sky-700" label="บิลที่ปิดแล้ว" value={billCount} />
        <StatCard icon={Package} tone="bg-amber-100 text-amber-700" label="ชิ้นที่ขายได้" value={soldItems} />
        <StatCard icon={TrendingUp} tone="bg-violet-100 text-violet-700" label="เฉลี่ยต่อบิล" value={formatTHB(avgPerBill)} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        ยอดสรุปนี้เป็นของรอบการใช้งานปัจจุบัน (ยังไม่บันทึกฐานข้อมูล — refresh แล้วเริ่มนับใหม่)
      </p>
    </section>
  )
}
