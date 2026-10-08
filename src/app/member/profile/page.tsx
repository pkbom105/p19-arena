import { SiteHeader } from '@/components/site-header'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { MemberLoginGate } from '@/components/member/member-login-gate'
import { MemberProfileMenu } from '@/components/member/member-profile-menu'
import { MemberBookings } from '@/components/member/member-bookings'

export const metadata = { title: 'โปรไฟล์สมาชิก — P19 Pickleball Arena' }

/**
 * หน้ากิจกรรม/สมาชิก > Profile > ตั๋ว (ค่าเริ่มต้น) — URL: /member/profile
 * เมนูย่อย 3 แท็บเป็นลิงก์จริง: /member/profile · /member/profile/wallet · /member/profile/user
 * แท็บนี้ไม่แสดง Wallet ID (อยู่ในแท็บกระเป๋าเงิน)
 */
export default function MemberProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <MemberLoginGate>
          <ActivityGroupMenu />
          <MemberProfileMenu />
          <MemberBookings />
        </MemberLoginGate>
      </main>
      <footer className="mt-auto border-t bg-white/60">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          © 2025 P19 Pickleball Arena. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
