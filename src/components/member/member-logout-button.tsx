'use client'

import { useState } from 'react'
import { Loader2, Unplug } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'

/**
 * ปุ่มออกจากระบบ (ใช้แทนไอคอนตั้งค่าใน SiteHeader ทุกหน้า)
 * ลำดับการทำงาน:
 *   1) POST /api/wallet/logout      → ล้างคุกกี้เซสชันของแอป (p19_customer_session)
 *   2) signOut() ของ next-auth      → ล้างเซสชัน Google (ถ้าล็อกอินด้วย Google)
 *      จำเป็นมาก: ถ้าไม่ล้าง MemberLoginGate จะ sync เซสชัน Google กลับเข้าให้ทันที
 *   3) reload                       → กลับไปสถานะเริ่มต้น (หน้า /member จะเจอบล็อกล็อกอินอีกครั้ง)
 */
export function MemberLogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/wallet/logout'), { method: 'POST' })
      if (!response.ok) throw new Error(`Logout failed (${response.status})`)
      await signOut({ redirect: false })
      window.location.reload()
    } catch (error) {
      console.error('Failed to sign out', error)
      toast.error('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="ออกจากระบบ"
      title="ออกจากระบบ"
      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
    </button>
  )
}
