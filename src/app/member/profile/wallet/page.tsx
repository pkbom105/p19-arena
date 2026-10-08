import { SiteHeader } from '@/components/site-header'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { MemberLoginGate } from '@/components/member/member-login-gate'
import { MemberProfileMenu } from '@/components/member/member-profile-menu'
import { MemberWalletPanel } from '@/components/member/member-profile-card'

export const metadata = { title: 'กระเป๋าเงิน — P19 Pickleball Arena' }

/** หน้ากิจกรรม/สมาชิก > Profile > กระเป๋าเงิน — URL: /member/profile/wallet (ยอดเงิน + Wallet ID) */
export default function MemberWalletPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <MemberLoginGate>
          <ActivityGroupMenu />
          <MemberProfileMenu />
          <MemberWalletPanel />
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
