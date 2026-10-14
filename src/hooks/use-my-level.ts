'use client'

import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/api'
import { isProfileLevel, type ProfileLevel } from '@/lib/permissions'

/**
 * ระดับสิทธิ์ของ "ตัวเอง" — อ่านจาก GET /api/wallet/session (ฝั่งเซิร์ฟเวอร์เป็นผู้ตัดสิน)
 * คืน null = ยังโหลดไม่เสร็จ / ยังไม่ล็อกอิน (ผู้เรียกควรซ่อนเมนูที่สงวนสิทธิ์ไว้)
 * ใช้ซ่อนเมนู "Profile" (super admin เท่านั้น) ใน nav-admin และ section-tabs
 */
export function useMyLevel(): ProfileLevel | null {
  const [level, setLevel] = useState<ProfileLevel | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/wallet/session'), { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (cancelled || typeof data !== 'object' || data === null) return
        const raw = (data as Record<string, unknown>).level
        if (isProfileLevel(raw)) setLevel(raw)
      })
      .catch(() => {
        // เงียบ — การซ่อน/แสดงเมนูไม่ควรทำให้หน้า error
      })
    return () => { cancelled = true }
  }, [])

  return level
}
