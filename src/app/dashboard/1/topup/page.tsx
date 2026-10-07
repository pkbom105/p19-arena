import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { TopupSection } from '@/components/dashboard/topup-section'

export const metadata = { title: 'Top up — P19 Arena' }

/** /dashboard/1/topup — หน้าของตัวเอง (ไม่ใช่แท็บของ Dashboard) */
export default function TopupPage() {
  return (
    <DashboardShell mobileTabs>
      <TopupSection />
    </DashboardShell>
  )
}