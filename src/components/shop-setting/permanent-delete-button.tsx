'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface PermanentDeleteButtonProps {
  /** ชื่อรายการที่กำลังจะลบ (ใช้ในข้อความยืนยัน + aria-label) */
  label: string
  /** ชนิดของรายการ เช่น "สินค้า" | "หมวด" (ใช้ประกอบข้อความ) */
  kind: string
  /** เรียกเมื่อผู้ใช้ยืนยันในไดอะล็อกแล้ว */
  onConfirm: () => void | Promise<void>
}

/**
 * ปุ่ม "ลบถาวร" + ไดอะล็อกยืนยันก่อนลบ (ใช้ทั้งการ์ดสินค้าและการ์ดหมวด)
 * ปุ่มนี้แสดงเฉพาะรายการที่ "ปิดใช้งาน" แล้วเท่านั้น — ผู้เรียกเป็นคนกำหนดเงื่อนไข
 */
export function PermanentDeleteButton({ label, kind, onConfirm }: PermanentDeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // ผู้เรียกแจ้ง error เองด้วย toast — คงไดอะล็อกไว้ให้ผู้ใช้ตัดสินใจใหม่
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!deleting) setOpen(v) }}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          aria-label={`ลบถาวร${kind} ${label}`}
        >
          <Trash2 className="mr-1 h-3 w-3" /> ลบถาวร
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันลบถาวร{kind}?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{label}&quot; จะถูกลบออกจากฐานข้อมูลจริง — กู้คืนไม่ได้
            (ต่างจาก &quot;ปิดใช้งาน&quot; ที่แค่ซ่อนจากหน้าแคชเชียร์)
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            aria-label={`ยืนยันลบถาวร ${label}`}
            disabled={deleting}
            onClick={(event) => {
              // ปิดไดอะล็อกเองหลังลบสำเร็จ (ไม่ให้ปิดก่อนที่คำสั่งจะจบ)
              event.preventDefault()
              handleConfirm()
            }}
          >
            {deleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
            ลบถาวร
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
