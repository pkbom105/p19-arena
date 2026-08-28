import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const INVALID_DAYS = 'INVALID'

/**
 * Normalize the `days` payload (array of ints, comma-string, '', null/undefined)
 * into a comma-separated string of valid day numbers 0-6.
 * Returns INVALID_DAYS if input contains an invalid day number.
 * An empty result (no days) => '' (ทุกวัน).
 */
function normalizeDays(days: unknown): string {
  let list: number[] = []

  if (Array.isArray(days)) {
    list = days.map((d) => Number(d))
  } else if (days === '' || days === null || days === undefined) {
    return ''
  } else {
    list = String(days)
      .split(',')
      .map((s) => {
        const n = parseInt(s.trim(), 10)
        return Number.isNaN(n) ? -1 : n
      })
  }

  for (const d of list) {
    if (!Number.isInteger(d) || d < 0 || d > 6) return INVALID_DAYS
  }

  // Dedupe + keep stable order
  const distinct = [...new Set(list)]
  return distinct.join(',')
}

export async function GET() {
  try {
    const rules = await db.priceRule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
    })
    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching price rules:', error)
    return NextResponse.json({ error: 'Failed to fetch price rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, days, startTime, endTime, price, sortOrder } = body

    if (startTime === undefined || endTime === undefined || startTime === '' || endTime === '') {
      return NextResponse.json({ error: 'startTime และ endTime จำเป็น' }, { status: 400 })
    }
    if (price === undefined || Number(price) < 0) {
      return NextResponse.json({ error: 'ราคาต้องเป็นจำนวนเต็มมากกว่าหรือเท่ากับ 0' }, { status: 400 })
    }

    const daysStr = normalizeDays(days)
    if (daysStr === INVALID_DAYS) {
      return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 })
    }

    const rule = await db.priceRule.create({
      data: {
        name: name ? String(name) : null,
        days: daysStr,
        startTime: String(startTime),
        endTime: String(endTime),
        price: Number(price),
        sortOrder: sortOrder === undefined ? 0 : Number(sortOrder) || 0,
      },
    })
    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error creating price rule:', error)
    return NextResponse.json({ error: 'Failed to create price rule' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, days, startTime, endTime, price, sortOrder } = body

    if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 })
    if (startTime === '' || endTime === '') {
      return NextResponse.json({ error: 'startTime และ endTime จำเป็น' }, { status: 400 })
    }
    if (price === undefined || Number(price) < 0) {
      return NextResponse.json({ error: 'ราคาไม่ถูกต้อง' }, { status: 400 })
    }

    const daysStr = normalizeDays(days)
    if (daysStr === INVALID_DAYS) {
      return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 })
    }

    const rule = await db.priceRule.update({
      where: { id: String(id) },
      data: {
        name: name ? String(name) : null,
        days: daysStr,
        startTime: String(startTime),
        endTime: String(endTime),
        price: Number(price),
        sortOrder: sortOrder === undefined ? 0 : Number(sortOrder) || 0,
      },
    })
    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error updating price rule:', error)
    return NextResponse.json({ error: 'Failed to update price rule' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Identifier จำเป็น' }, { status: 400 })
    await db.priceRule.delete({ where: { id: String(id) } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting price rule:', error)
    return NextResponse.json({ error: 'Failed to delete price rule' }, { status: 500 })
  }
}