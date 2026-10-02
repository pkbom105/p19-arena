import { db } from '@/lib/db'
import { COACH_PACKAGES } from '@/components/activity/coaches'

/** เตรียมตารางโค้ชให้พร้อม — seed หมวดที่ยังไม่มีจาก COACH_PACKAGES (โค้ชต้น/โค้ชเมย์) */
export async function ensureCoaches() {
  const existing = await db.coach.findMany({ select: { id: true } })
  const existingIds = new Set(existing.map((r) => r.id))
  const missing = COACH_PACKAGES.filter((c) => !existingIds.has(c.id))
  if (missing.length === 0) return
  await db.coach.createMany({
    data: missing.map((c, i) => ({
      id: c.id,
      name: c.name,
      initial: c.initial,
      level: c.level,
      pricePerHour: c.pricePerHour,
      experienceYears: c.experienceYears,
      specialties: c.specialties.join(','),
      availableDays: c.availableDays,
      rating: c.rating,
      sortOrder: i,
    })),
  })
}
