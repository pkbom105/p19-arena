import { SiteHeader } from '@/components/site-header'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { ActivitiesSubMenu } from '@/components/activity/activities-sub-menu'
import { PartyMatchSection } from '@/components/activity/party-match-section'
import { MemberLoginGate } from '@/components/member/member-login-gate'

export const metadata = { title: 'Party Match — P19 Pickleball Arena' }

/** หน้ากิจกรรม/สมาชิก > กิจกรรม > Party Match — sub-menu ที่มี URL และไฟล์เนื้อหาของตัวเอง */
export default function MemberPartyMatchPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <MemberLoginGate>
          <ActivityGroupMenu />
          <ActivitiesSubMenu />
          <PartyMatchSection />
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
