import { SiteHeader } from '@/components/site-header'
import { ACTIVITY_GROUPS } from '@/components/activity/groups'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { ActivitiesSubMenu } from '@/components/activity/activities-sub-menu'

const group = ACTIVITY_GROUPS[2]
const Icon = group.icon

/** หน้ากิจกรรม > กิจกรรม — มีเมนูย่อย (Party Match) ที่ยังไม่มีเนื้อหา + placeholder ของกลุ่ม */
export default function ActivitiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <ActivityGroupMenu />
        <ActivitiesSubMenu />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center bg-white/60">
          <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold text-lg">{group.label}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            กำลังพัฒนา — {group.desc} เร็ว ๆ นี้
          </p>
        </div>
      </main>
      <footer className="mt-auto border-t bg-white/60">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          © 2025 P19 Pickleball Arena. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
