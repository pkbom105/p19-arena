import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { isSlotStarted } from '@/lib/slot-time'
import { canAssignLevel, isProfileLevel, resolveProfileLevel, type ProfileLevel } from '@/lib/permissions'
import { requireAdminApi } from '@/lib/require-admin'

/** note ของแต่ละโปรไฟล์เก็บในตาราง Settings ด้วยคีย์นี้ (ไม่ต้องเพิ่มคอลัมน์ใน schema) */
const USER_NOTE_PREFIX = 'user_note_'
/** ความยาวสูงสุดของ note ต่อโปรไฟล์ */
const USER_NOTE_MAX = 500

export async function GET(request: Request) {
  // ต้องเป็น admin ขึ้นไป (ระดับจาก DB + คุกกี้เซสชัน — ตรวจฝั่งเซิร์ฟเวอร์เท่านั้น)
  const guard = await requireAdminApi(request)
  if ('response' in guard) return guard.response

  try {
    const [users, notes] = await Promise.all([
      db.user.findMany({
        where: { OR: [{ lineUserId: { not: null } }, { googleId: { not: null } }] },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          lineUserId: true,
          lineDisplayName: true,
          linePictureUrl: true,
          googleId: true,
          googleName: true,
          googlePictureUrl: true,
          name: true,
          phone: true,
          email: true,
          walletBalance: true,
          level: true,
          createdAt: true,
          _count: { select: { bookings: true, topUpRequests: true } },
          // ใช้ตัดสินว่ามี "การจองที่ยังไม่ถึงกำหนด" หรือไม่ — โปรไฟล์ที่มีจองค้างจะลบไม่ได้
          bookings: {
            where: { status: { not: 'cancelled' } },
            select: { bookingDate: true, timeSlot: { select: { startTime: true } } },
          },
        },
      }),
      // note ของแต่ละโปรไฟล์เก็บในตาราง Settings (คีย์ user_note_<id>) — ไม่ต้องแก้ schema
      db.settings.findMany({ where: { key: { startsWith: USER_NOTE_PREFIX } }, select: { key: true, value: true } }),
    ])

    const noteMap = new Map(notes.map((row) => [row.key.slice(USER_NOTE_PREFIX.length), row.value]))
    const now = new Date()
    const data = users.map(({ bookings, ...user }) => {
      const upcomingBookings = bookings.filter(
        (booking) => !isSlotStarted(booking.bookingDate, booking.timeSlot.startTime, now)
      ).length
      return {
        ...user,
        // ระดับที่ "ใช้จริง" (บัญชีเจ้าของงาน = super_admin เสมอ) — ให้ตรงกับที่ guard ใช้ตัดสิน
        level: resolveProfileLevel(user),
        note: noteMap.get(user.id) ?? null,
        upcomingBookings,
        pastBookings: bookings.length - upcomingBookings,
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load admin wallet balances', error)
    return NextResponse.json({ error: 'Failed to load wallet balances' }, { status: 500 })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * PATCH — แก้ไขข้อมูลโปรไฟล์ (ชื่อ / เบอร์โทร / อีเมล / note)
 * ⚠️ ไม่แตะ walletBalance — การเปลี่ยนยอดเงินต้องผ่าน /api/admin/topups (อนุมัติสลิป) เท่านั้น
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireAdminApi(request)
  if ('response' in guard) return guard.response

  try {
    const body: unknown = await request.json().catch(() => null)
    if (!isRecord(body) || typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'ต้องระบุ id ของโปรไฟล์' }, { status: 400 })
    }

    const clean = (value: unknown, max: number): string | undefined =>
      typeof value === 'string' ? value.trim().slice(0, max) : undefined

    const name = clean(body.name, 120)
    const phone = clean(body.phone, 40)
    const email = clean(body.email, 160)
    const note = clean(body.note, USER_NOTE_MAX)

    /**
     * ระดับสิทธิ์ใหม่ (ถ้าส่งมา) — กติกาใน profile.md:
     *  admin ตั้งได้ user/admin · super admin ตั้ง super_admin ได้ด้วย
     */
    let levelToSet: ProfileLevel | undefined
    if (body.level !== undefined) {
      if (!isProfileLevel(body.level)) {
        return NextResponse.json({ error: 'ระดับสิทธิ์ไม่ถูกต้อง (user / admin / super_admin)' }, { status: 400 })
      }
      if (!canAssignLevel(guard.session.level, body.level)) {
        return NextResponse.json(
          { error: 'ตั้งระดับสิทธิ์ได้เฉพาะ Super admin เท่านั้น' },
          { status: 403 }
        )
      }
      levelToSet = body.level
    }

    if (name === undefined && phone === undefined && email === undefined && note === undefined && levelToSet === undefined) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id: body.id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบโปรไฟล์นี้' }, { status: 404 })
    }

    const updated = await db.user.update({
      where: { id: body.id },
      data: {
        ...(name !== undefined ? { name: name || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(levelToSet !== undefined ? { level: levelToSet } : {}),
      },
      select: { id: true, name: true, phone: true, email: true, level: true },
    })

    // note เก็บในตาราง Settings (คีย์ user_note_<id>) — ว่าง = ลบแถวทิ้ง
    if (note !== undefined) {
      const noteKey = `${USER_NOTE_PREFIX}${body.id}`
      if (note === '') {
        await db.settings.deleteMany({ where: { key: noteKey } })
      } else {
        await db.settings.upsert({
          where: { key: noteKey },
          update: { value: note },
          create: { key: noteKey, value: note },
        })
      }
    }

    return NextResponse.json({
      ...updated,
      // ระดับที่ "ใช้จริง" — บัญชีเจ้าของงานจะได้ super_admin เสมอ แม้ค่าใน DB เป็นอย่างอื่น
      level: resolveProfileLevel(updated),
      ...(note !== undefined ? { note: note === '' ? null : note } : {}),
    })
  } catch (error) {
    console.error('Failed to update member profile', error)
    return NextResponse.json({ error: 'แก้ไขโปรไฟล์ไม่สำเร็จ' }, { status: 500 })
  }
}

/**
 * DELETE ?id=… — ลบโปรไฟล์ตามกติกา "การจอง"
 * ✓ ลบได้: ไม่มีการจองที่ยังไม่ถึงกำหนด + ยอดเงิน 0 + ไม่มีประวัติเติมเงิน
 * ✗ ห้ามลบ: มีการจองที่ยังไม่ถึงกำหนด (จองค้าง) / กระเป๋ามียอดเงิน / มีประวัติเติมเงิน
 *   - การจองที่ "ผ่านแล้ว" ไม่บล็อกการลบ และจะยังอยู่ในระบบต่อ (Booking.userId เป็น optional → ถูกตัดความเชื่อมโยง)
 *   - TopUpRequest เป็น onDelete: Cascade → ถ้าลบทั้งที่มีประวัติ ประวัติเงินจะหาย จึงกันไว้
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminApi(request)
  if ('response' in guard) return guard.response

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ต้องระบุ id ของโปรไฟล์' }, { status: 400 })
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        lineDisplayName: true,
        walletBalance: true,
        _count: { select: { bookings: true, topUpRequests: true } },
        bookings: {
          where: { status: { not: 'cancelled' } },
          select: { bookingDate: true, timeSlot: { select: { startTime: true } } },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'ไม่พบโปรไฟล์นี้' }, { status: 404 })
    }

    const now = new Date()
    const upcoming = user.bookings.filter(
      (booking) => !isSlotStarted(booking.bookingDate, booking.timeSlot.startTime, now)
    ).length
    const topups = user._count.topUpRequests

    if (upcoming > 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้: มีการจองที่ยังไม่ถึงกำหนด ${upcoming} รายการ (รอให้ถึงกำหนดหรือยกเลิกก่อน)`, reason: 'upcoming', upcoming },
        { status: 409 }
      )
    }
    if (user.walletBalance !== 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้: กระเป๋ายังมียอดเงิน ${user.walletBalance} บาท (ต้องเป็น 0 ก่อน)`, reason: 'balance', walletBalance: user.walletBalance },
        { status: 409 }
      )
    }
    if (topups > 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้: มีประวัติเติมเงิน ${topups} รายการ (การลบโปรไฟล์จะลบประวัติตามไปด้วย)`, reason: 'topups', topups },
        { status: 409 }
      )
    }

    // ลบ note ที่ผูกกับโปรไฟล์นี้ด้วย (เก็บในตาราง Settings)
    await db.settings.deleteMany({ where: { key: `${USER_NOTE_PREFIX}${id}` } })
    await db.user.delete({ where: { id } })
    // การจองที่ผ่านแล้วยังคงอยู่ในระบบ (ถูกตัดความเชื่อมโยงกับโปรไฟล์เท่านั้น)
    return NextResponse.json({ success: true, id, detachedBookings: user._count.bookings })
  } catch (error) {
    console.error('Failed to delete member profile', error)
    return NextResponse.json({ error: 'ลบโปรไฟล์ไม่สำเร็จ' }, { status: 500 })
  }
}
