'use client'

import { CheckCircle2, Clock, Receipt, XCircle } from 'lucide-react'

interface SlipStatsProps {
  slips: number
  pendingReview: number
  confirmed: number
  missing: number
}

/** สรุปจำนวนสลิป 4 ช่อง — ใช้ในหน้า Dashboard → Slip Upload */
export function SlipStats({ slips, pendingReview, confirmed, missing }: SlipStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" /> สลิปที่ส่งแล้ว
        </div>
        <div className="mt-1 text-2xl font-bold">{slips}</div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-amber-600" /> รอตรวจสอบ
        </div>
        <div className="mt-1 text-2xl font-bold text-amber-600">{pendingReview}</div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> ยืนยันแล้ว
        </div>
        <div className="mt-1 text-2xl font-bold text-emerald-700">{confirmed}</div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <XCircle className="h-3.5 w-3.5 text-red-500" /> ยังไม่มีสลิป
        </div>
        <div className="mt-1 text-2xl font-bold text-red-500">{missing}</div>
      </div>
    </div>
  )
}
