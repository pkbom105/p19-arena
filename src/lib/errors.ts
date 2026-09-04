/**
 * Error tracking helper (server-side) — บันทึกลง SQLite ผ่าน Prisma
 * ใช้ self-hosted crash reporting แทนบริการภายนอก (Sentry ฯลฯ)
 */
import { db } from '@/lib/db'

export async function captureError(opts: {
  message: string
  stack?: string
  level?: string
  path?: string
  userAgent?: string
  source?: string
}): Promise<void> {
  try {
    await db.errorLog.create({
      data: {
        message: opts.message.slice(0, 2000),
        stack: opts.stack?.slice(0, 8000),
        level: opts.level ?? 'error',
        path: opts.path?.slice(0, 500),
        userAgent: opts.userAgent?.slice(0, 500),
        source: opts.source ?? 'server',
      },
    })
  } catch (e) {
    // อย่าให้ error logging ล้มแอป — พิมพ์ทิ้งไว้ใน log ของ container
    console.error('[error-tracking] failed to persist error:', e)
  }
}
