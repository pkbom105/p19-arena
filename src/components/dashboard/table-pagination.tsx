'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** จำนวนแถวต่อหน้า ของตารางในหน้า Top up (ทั้งรายการจอง และรายการ Top-up) */
export const TABLE_PAGE_SIZE = 5

/**
 * ตัดข้อมูลเป็นหน้า ๆ ให้ตาราง — clamp เลขหน้าเกินขอบเขตให้อัตโนมัติ
 * (ใช้เมื่อข้อมูลถูกโหลดมาทั้งหมดแล้ว แล้วแบ่งหน้าในเบราว์เซอร์ ไม่ยิง API เพิ่ม)
 */
export function paginate<T>(items: T[], page: number, pageSize: number = TABLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const start = (currentPage - 1) * pageSize
  return { totalPages, currentPage, rows: items.slice(start, start + pageSize) }
}

interface TablePaginationProps {
  /** หน้าปัจจุบัน (เริ่มที่ 1) */
  page: number
  /** จำนวนแถวต่อหน้า */
  pageSize: number
  /** จำนวนรายการทั้งหมด (ก่อนแบ่งหน้า) */
  total: number
  /** ชื่อรายการ ใช้ในข้อความสรุป เช่น "รายการจอง" */
  itemLabel: string
  onPageChange: (page: number) => void
}

/**
 * แถบแบ่งหน้าใต้ตารางในหน้า Top up — ไม่แสดงเมื่อไม่มีรายการ
 * และซ่อนปุ่มก่อนหน้า/ถัดไปเมื่อมีหน้าเดียว (เหลือแค่ข้อความสรุปจำนวน)
 */
export function TablePagination({ page, pageSize, total, itemLabel, onPageChange }: TablePaginationProps) {
  if (total === 0) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <p className="text-xs text-muted-foreground">
        {itemLabel} {total.toLocaleString()} รายการ · หน้า {page}/{totalPages}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            ก่อนหน้า
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ถัดไป
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
