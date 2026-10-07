import { NextResponse } from 'next/server'

/**
 * สถานะการ "เปิดใช้ช่องทางล็อกอิน" (ฝั่ง server) — ใช้แสดงป้ายในหน้า View Profile
 *
 * - google: เปิดใช้เมื่อมี GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (env ฝั่ง server เท่านั้น)
 *   (LINE ตรวจจาก settings ใน DB ฝั่ง client อยู่แล้ว จึงไม่ต้องส่งมาที่นี่)
 */
export async function GET() {
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  )
  return NextResponse.json({ google: { configured: googleConfigured } })
}
