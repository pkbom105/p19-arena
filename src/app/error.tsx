'use client'

import { useEffect } from 'react'
import { apiUrl } from '@/lib/api'

/**
 * Error boundary ระดับ route — เกิด error ในหน้าไหนก็จับที่นี่
 * พร้อมรายงานเข้า /api/errors (บันทึกลง ErrorLog ใน DB) แล้วโชว์ UI กู้คืน
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // รายงาน error ไปที่ server (fire-and-forget)
    fetch(apiUrl('/api/errors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: window.location.pathname,
      }),
    }).catch(() => {
      /* รายงานไม่สำเร็จก็ปล่อยเงียบไว้ */
    })
    console.error('[client-error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-6 text-center space-y-3">
        <div className="text-4xl">:(</div>
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">เกิดข้อผิดพลาด</h2>
        <p className="text-sm text-red-600/80 dark:text-red-400/80 break-words">
          {error.message || 'Something went wrong'}
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">รหัสอ้างอิง: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          ลองอีกครั้ง
        </button>
      </div>
    </div>
  )
}
