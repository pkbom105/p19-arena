import { SiteHeader } from '@/components/site-header'
import { ActivityGroupMenu } from '@/components/activity/group-menu'
import { CoachBooking } from '@/components/activity/coach-booking'

/** หน้ากิจกรรม > โค้ช — mockup flow: จองแพ็กเกจโค้ช แล้วเลือกวัน–เวลา */
export default function CoachPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <ActivityGroupMenu />
        <div>
          <h2 className="text-lg font-bold">จองโค้ช</h2>
          <p className="text-sm text-muted-foreground">เลือกแพ็กเกจโค้ช แล้วเลือกวันและเวลาที่ต้องการ</p>
        </div>
        <CoachBooking />
      </main>
      <footer className="mt-auto border-t bg-white/60">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          © 2025 P19 Pickleball Arena. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

