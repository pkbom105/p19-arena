import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import type { Booking } from '@prisma/client'

/** ขนาดสลิปสูงสุด — ตรงกับฝั่ง UI (step-confirm / slip-upload-card) */
const MAX_SLIP_BYTES = 300 * 1024

/** ประเมินขนาดไฟล์จาก data URL (base64) โดยไม่ต้อง decode */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = (base64.match(/=+$/) ?? [''])[0].length
  return Math.floor((base64.length * 3) / 4) - padding
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lineUserId = searchParams.get('lineUserId')
    const playerPhone = searchParams.get('playerPhone')
    const ticketCode = searchParams.get('ticketCode')

    if (!lineUserId && !playerPhone && !ticketCode) {
      return NextResponse.json(
        { error: 'กรุณาระบุ lineUserId, playerPhone หรือ ticketCode' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (lineUserId) {
      const user = await db.user.findUnique({ where: { lineUserId } })
      if (user) {
        where.userId = user.id
      } else {
        return NextResponse.json([])
      }
    }
    if (playerPhone) {
      where.playerPhone = playerPhone
    }
    if (ticketCode) {
      // รหัสตั๋วเก็บเป็นตัวพิมพ์ใหญ่เสมอ — แปลงให้ค้นได้ทั้งพิมพ์เล็ก/พิมพ์ใหญ่
      where.ticketCode = ticketCode.trim().toUpperCase()
    }

    const bookings = await db.booking.findMany({
      where,
      include: {
        court: true,
        timeSlot: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching my bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

/**
 * PUT /api/my-bookings — ลูกค้า "ส่งสลิปการชำระเงิน" หลังจองแล้ว (จากหน้า /check)
 * ระบุเป้าหมายได้ด้วยอย่างใดอย่างหนึ่ง: bookingId, ticketCode หรือ playerPhone
 * - ticketCode/bookingId → อัปเดตการจองนั้นโดยตรง
 * - playerPhone → อัปเดตการจองล่าสุดที่ไม่ถูกยกเลิกของเบอร์นั้น
 * หลังส่งสลิปแล้วสถานะเปลี่ยนเป็น 'pending' (รอตรวจสอบการชำระ) ให้แอดมินยืนยันใน Dashboard
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { bookingId, ticketCode, playerPhone, slipName, slipDataUrl } = body ?? {}

    const hasTarget = !!(bookingId || ticketCode || playerPhone)
    if (!hasTarget) {
      return NextResponse.json(
        { error: 'กรุณาระบุรหัสตั๋วหรือเบอร์โทรศัพท์' },
        { status: 400 }
      )
    }

    if (typeof slipDataUrl !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(slipDataUrl)) {
      return NextResponse.json(
        { error: 'ไฟล์สลิปไม่ถูกต้อง — รองรับเฉพาะ .jpg หรือ .png' },
        { status: 400 }
      )
    }
    if (dataUrlBytes(slipDataUrl) > MAX_SLIP_BYTES) {
      return NextResponse.json(
        { error: 'ไฟล์สลิปใหญ่เกินไป (สูงสุด 300kB)' },
        { status: 400 }
      )
    }

    // หาการจองเป้าหมาย
    let booking: Booking | null = null
    if (bookingId) {
      booking = await db.booking.findUnique({ where: { id: String(bookingId) } })
    } else if (ticketCode) {
      booking = await db.booking.findFirst({
        where: { ticketCode: String(ticketCode).trim().toUpperCase() },
        orderBy: { createdAt: 'desc' },
      })
    } else {
      booking = await db.booking.findFirst({
        where: { playerPhone: String(playerPhone).trim(), status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'ไม่พบการจอง — ตรวจสอบรหัสตั๋ว/เบอร์โทรอีกครั้ง' },
        { status: 404 }
      )
    }
    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { error: 'การจองนี้ถูกยกเลิกแล้ว ไม่สามารถส่งสลิปได้' },
        { status: 400 }
      )
    }

    const updated = await db.booking.update({
      where: { id: booking.id },
      data: {
        slipDataUrl,
        slipName: (typeof slipName === 'string' && slipName.trim()) || booking.slipName || 'slip.jpg',
        // ส่งสลิปแล้ว = รอแอดมินตรวจสอบการชำระ
        status: 'pending',
      },
      include: { court: true, timeSlot: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error uploading slip:', error)
    return NextResponse.json({ error: 'Failed to upload slip' }, { status: 500 })
  }
}
