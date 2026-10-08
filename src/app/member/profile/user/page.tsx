import { SiteHeader } from '@/components/site-header'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { MemberLoginGate } from '@/components/member/member-login-gate'
import { MemberProfileMenu } from '@/components/member/member-profile-menu'
import { MemberUserPanel } from '@/components/member/member-profile-card'

export const metadata = { title: 'บัญชีผู้ใช้ — P19 Pickleball Arena' }

/** หน้ากิจกรรม/สมาชิก > Profile > ผู้ใช้ — URL: /member/profile/user (ชื่อ/รูป + ช่องทาง + ปุ่มเชื่อม) */
export default function MemberUserPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <MemberLoginGate>
          <ActivityGroupMenu />
          <MemberProfileMenu />
          <MemberUserPanel />
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
