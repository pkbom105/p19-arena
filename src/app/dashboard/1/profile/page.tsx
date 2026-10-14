import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { CustomerWalletsTable } from '@/components/dashboard/customer-wallets-table'

export const metadata = { title: 'Profile — P19 Arena' }

/**
 * /dashboard/1/profile — หน้าของตัวเอง (ไม่ใช่แท็บของ Dashboard)
 * แสดงตารางโปรไฟล์ลูกค้า + ยอดกระเป๋า + สถานะล็อกอิน + ปุ่มแก้ไข/ลบ
 * (ย้ายมาจากหน้า Top up — เดิมเป็นกริดการ์ด "Customer wallets")
 */
export default function ProfilePage() {
  return (
    <DashboardShell mobileTabs>
      <CustomerWalletsTable />
    </DashboardShell>
  )
}
