import { Users } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { MemberLoginGate } from '@/components/member/member-login-gate'

export const metadata = { title: 'สมาชิก — P19 Pickleball Arena' }

/**
 * หน้ากิจกรรม/สมาชิก (ย้ายมาจาก /activity → /member)
 * ลำดับการแสดง: บล็อกเข้าสู่ระบบ (Google / LINE) ก่อน → ผ่านแล้วจึงแสดงเมนูย่อย + เนื้อหา
 */
export default function MemberPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <MemberLoginGate>
          <ActivityGroupMenu />
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center bg-white/60">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="font-semibold text-lg">สมาชิก</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              เลือกเมนูด้านบน — โปรไฟล์ กิจกรรม และโค้ช
            </p>
          </div>
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
