import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export const metadata = { title: 'Profile — P19 Arena' }

/**
 * /dashboard/1/profile — หน้าของตัวเอง (ไม่ใช่แท็บของ Dashboard)
 * โครงหน้าเปล่า: header + tab bar เท่านั้น — เนื้อหาด้านในยังว่าง (จะเติมทีหลัง)
 */
export default function ProfilePage() {
  return <DashboardShell mobileTabs>{null}</DashboardShell>
}
