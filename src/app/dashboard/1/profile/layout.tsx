import { redirect } from 'next/navigation'
import { getSessionLevelFromCookies } from '@/lib/require-admin'
import { canAccessDashboard, canViewProfilePage, DASHBOARD_HOME_PATH } from '@/lib/permissions'

/**
 * Guard เฉพาะหน้า /dashboard/1/profile — **super admin เท่านั้น**
 *
 * - ระดับต่ำกว่า admin: เด้งไปหน้าแรก '/' (ชั้นบนสุดคือ dashboard/layout.tsx ที่กันไว้แล้ว)
 * - admin (ไม่ใช่ super admin): เด้งไปหน้าแรกของ Dashboard (ดูระดับสิทธิ์ได้ แต่แก้ไม่ได้)
 * - super admin (เจ้าของงาน): เข้าได้
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionLevelFromCookies()
  if (!session) redirect('/')
  if (!canViewProfilePage(session.level)) {
    redirect(canAccessDashboard(session.level) ? DASHBOARD_HOME_PATH : '/')
  }
  return <>{children}</>
}
