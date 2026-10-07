'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Store, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatThaiDate } from './helpers'

/** ตัวควบคุมซูมของตาราง — ส่งมาเฉพาะหน้าที่ต้องการ (เช่นหน้าตารางจอง) */
export interface HeaderZoom {
  /** ระดับซูมปัจจุบัน (%) */
  level: number
  onZoomIn: () => void
  onZoomOut: () => void
  /** คลิกที่ตัวเลข % เพื่อกลับไป 100 */
  onReset: () => void
}

/** Top bar — กลับ Dashboard, ชื่อหน้า, วันที่ที่เลือก, ซูม (ถ้าส่งมา), รีเฟรช */
export function PosHeader({ date, refreshing, onRefresh, title = 'pos-booking', zoom }: {
  date: string
  refreshing: boolean
  onRefresh?: () => void
  title?: string
  /** ซูมเข้า/ออกของตาราง — ถ้าไม่ส่งมา ปุ่มจะไม่แสดง (หน้าอื่นไม่กระทบ) */
  zoom?: HeaderZoom
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="flex items-center gap-2 px-4 h-14">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push('/dashboard/1')} aria-label="กลับ Dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Store className="h-6 w-6 text-emerald-600 shrink-0" />
        <h1 className="font-bold text-lg whitespace-nowrap">{title}</h1>
        <Badge variant="secondary" className="text-xs hidden md:inline-flex">{formatThaiDate(date)}</Badge>

        {/* ปุ่มซูม (แสดงเฉพาะหน้าที่ส่ง prop zoom มา) — วางก่อนปุ่มรีเฟรช */}
        {zoom && (
          <div data-slot="zoom-controls" className="ml-auto flex items-center gap-1">
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">Zoom</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={zoom.onZoomOut}
              disabled={zoom.level <= 50}
              aria-label="ซูมออก (Zoom Out)"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={zoom.onReset}
              className="h-8 min-w-[3.5rem] rounded-md border border-input bg-background px-2 text-xs font-medium tabular-nums transition-colors hover:bg-muted"
              aria-label={`ระดับซูม ${zoom.level}% — คลิกเพื่อรีเซ็ต`}
              title="รีเซ็ตเป็น 100%"
            >
              {zoom.level}%
            </button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={zoom.onZoomIn}
              disabled={zoom.level >= 150}
              aria-label="ซูมเข้า (Zoom In)"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        )}

        {onRefresh && (
          <Button variant="outline" size="icon" className={`h-8 w-8 ${zoom ? '' : 'ml-auto'}`} onClick={onRefresh} disabled={refreshing} aria-label="รีเฟรช">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    </header>
  )
}
