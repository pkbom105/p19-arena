import { redirect } from 'next/navigation'
import { getSessionLevelFromCookies } from '@/lib/require-admin'
import { canAccessDashboard } from '@/lib/permissions'

/**
 * Guard ของทุกหน้าใต้ /dashboard/* (Level 1 Admin)
 *
 * กติกาตาม profile.md:
 *  - ต้องล็อกอินก่อน (คุกกี้ p19_customer_session)
 *  - ระดับต้องเป็น admin หรือ super_admin → ไม่งั้นเด้งกลับหน้าแรก (home/booking)
 *  - user (ค่าเริ่มต้นของทุกคนที่ล็อกอิน LINE/Google) เข้า Dashboard ไม่ได้จนกว่าจะถูกตั้งสิทธิ์
 *
 * หมายเหตุ: เป็น server component จึงตรวจฝั่งเซิร์ฟเวอร์ทุกครั้งที่เข้าหน้า (client ข้ามไม่ได้)
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionLevelFromCookies()
  if (!session || !canAccessDashboard(session.level)) {
    redirect('/')
  }
  return <>{children}</>
}
