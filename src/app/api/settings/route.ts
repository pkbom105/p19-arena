import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const settings = await db.settings.findMany()
    const kv: Record<string, string> = {}
    for (const s of settings) {
      // ป้องไม่ให้ secret ถูกส่งกลับไป client — แสดงว่า set แล้ว (masked)
      if (s.key === 'line_channel_secret' || s.key === 'line_messaging_channel_secret') {
        kv[s.key] = s.value.trim() ? '********' : ''
      } else {
        kv[s.key] = s.value
      }
    }
    return NextResponse.json(kv)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    // ถ้า client ส่งค่า masked กลับ (********) → ไม่บันทึก (ค่าจริงยังอยู่)
    const rawValue = String(value ?? '')
    if ((key === 'line_channel_secret' || key === 'line_messaging_channel_secret') && rawValue === '********') {
      return NextResponse.json({ ok: true, masked: true })
    }

    const setting = await db.settings.upsert({
      where: { key },
      update: { value: rawValue },
      create: { key, value: rawValue },
    })
    return NextResponse.json(setting)
  } catch (error) {
    console.error('Error updating setting:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
