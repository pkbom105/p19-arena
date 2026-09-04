import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const [
      totalBookings,
      pendingCount,
      confirmedCount,
      cancelledCount,
      todayCount,
      upcomingCount,
      courtCount,
      equipmentCount,
      ruleCount,
      userCount,
      recentBookings,
      todayBookings,
      courts,
    ] = await Promise.all([
      db.booking.count(),
      db.booking.count({ where: { status: 'pending' } }),
      db.booking.count({ where: { status: 'confirmed' } }),
      db.booking.count({ where: { status: 'cancelled' } }),
      db.booking.count({ where: { bookingDate: today } }),
      db.booking.count({
        where: { bookingDate: { gte: today }, status: { in: ['pending', 'confirmed'] } },
      }),
      db.court.count({ where: { isActive: true } }),
      db.rentalEquipment.count({ where: { isActive: true } }),
      db.priceRule.count(),
      db.user.count(),
      db.booking.findMany({
        where: { status: { in: ['pending', 'confirmed'] } },
        include: {
          court: true,
          timeSlot: true,
          user: { select: { name: true, lineDisplayName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.booking.findMany({
        where: { bookingDate: today, status: { in: ['pending', 'confirmed'] } },
        include: { court: true, timeSlot: true },
        orderBy: { timeSlot: { sortOrder: 'asc' } },
      }),
      db.court.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ])

    // สรุปจองวันนี้ต่อสนาม (ไม่ double-count; ~ราคาประมาณจาก pricePerHour ของสนาม)
    const todayByCourt = courts.map((court) => {
      const list = todayBookings.filter((b) => b.courtId === court.id)
      return {
        courtId: court.id,
        name: court.name,
        count: list.length,
        revenueEstimate: list.length * court.pricePerHour,
      }
    })

    const activeToday = todayBookings
    const revenueToday = activeToday.reduce((sum, b) => sum + (b.court?.pricePerHour ?? 0), 0)

    return NextResponse.json({
      totals: {
        bookings: totalBookings,
        courts: courtCount,
        equipment: equipmentCount,
        priceRules: ruleCount,
        users: userCount,
      },
      status: {
        pending: pendingCount,
        confirmed: confirmedCount,
        cancelled: cancelledCount,
      },
      today: {
        date: today,
        count: todayCount,
        activeCount: activeToday.length,
        revenueEstimate: revenueToday,
        byCourt: todayByCourt,
        bookings: todayBookings,
      },
      upcoming: upcomingCount,
      recent: recentBookings,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}