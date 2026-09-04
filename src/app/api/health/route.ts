import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/health — Server Health endpoint (สำหรับ docker healthcheck + monitoring)
 * ตรวจ: process uptime, memory, และการเชื่อมต่อฐานข้อมูล (db latency)
 * 200 = healthy / 503 = unhealthy
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  let dbOk = false
  let dbLatencyMs: number | null = null
  let dbError: string | null = null

  try {
    await db.$queryRaw`SELECT 1`
    dbOk = true
    dbLatencyMs = Date.now() - startedAt
  } catch (e) {
    dbError = e instanceof Error ? e.message.slice(0, 300) : 'unknown db error'
  }

  const mem = process.memoryUsage()
  const body = {
    status: dbOk ? 'ok' : 'degraded',
    uptimeSec: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    db: {
      ok: dbOk,
      latencyMs: dbLatencyMs,
      error: dbError,
    },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(body, { status: dbOk ? 200 : 503 })
}
