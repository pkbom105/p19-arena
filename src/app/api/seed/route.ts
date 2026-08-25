import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const courtCount = await db.court.count()

    if (courtCount === 0) {
      await Promise.all([
        db.court.create({ data: { name: 'สนาม 1', description: 'P19 Pickleball Court A', sortOrder: 1, pricePerHour: 300 } }),
        db.court.create({ data: { name: 'สนาม 2', description: 'P19 Pickleball Court B', sortOrder: 2, pricePerHour: 300 } }),
        db.court.create({ data: { name: 'สนาม 3', description: 'P19 Pickleball Court C', sortOrder: 3, pricePerHour: 400 } }),
      ])

      const slots = [
        { startTime: '08:00', endTime: '09:00', dayOfWeek: 0, sortOrder: 1 },
        { startTime: '09:00', endTime: '10:00', dayOfWeek: 0, sortOrder: 2 },
        { startTime: '10:00', endTime: '11:00', dayOfWeek: 0, sortOrder: 3 },
        { startTime: '11:00', endTime: '12:00', dayOfWeek: 0, sortOrder: 4 },
        { startTime: '13:00', endTime: '14:00', dayOfWeek: 0, sortOrder: 5 },
        { startTime: '14:00', endTime: '15:00', dayOfWeek: 0, sortOrder: 6 },
        { startTime: '15:00', endTime: '16:00', dayOfWeek: 0, sortOrder: 7 },
        { startTime: '16:00', endTime: '17:00', dayOfWeek: 0, sortOrder: 8 },
        { startTime: '17:00', endTime: '18:00', dayOfWeek: 0, sortOrder: 9 },
        { startTime: '18:00', endTime: '19:00', dayOfWeek: 0, sortOrder: 10 },
        { startTime: '19:00', endTime: '20:00', dayOfWeek: 0, sortOrder: 11 },
        { startTime: '20:00', endTime: '21:00', dayOfWeek: 0, sortOrder: 12 },
      ]

      for (let day = 0; day <= 6; day++) {
        for (const slot of slots) {
          await db.timeSlot.create({
            data: { ...slot, dayOfWeek: day },
          })
        }
      }
    }

    // Always ensure equipment and settings exist (idempotent)
    const equipCount = await db.rentalEquipment.count()
    if (equipCount === 0) {
      await db.rentalEquipment.create({
        data: { name: 'แร็กเก็ตพิคเคิลบอล', nameEn: 'Pickleball Racket', pricePerUnit: 50, sortOrder: 1 },
      })
    }
    // Remove ball equipment if exists (balls are free)
    await db.rentalEquipment.deleteMany({
      where: { name: { startsWith: 'บอล' } },
    })

    await db.settings.upsert({
      where: { key: 'arena_name' },
      update: {},
      create: { key: 'arena_name', value: 'P19 Pickleball Arena' },
    })
    await db.settings.upsert({
      where: { key: 'arena_phone' },
      update: {},
      create: { key: 'arena_phone', value: '02-xxx-xxxx' },
    })
    await db.settings.upsert({
      where: { key: 'arena_address' },
      update: {},
      create: { key: 'arena_address', value: 'P19 Pickleball Arena' },
    })

    return NextResponse.json({ message: 'Seed completed' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}
