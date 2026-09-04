import { NextRequest, NextResponse } from 'next/server'
import { captureError } from '@/lib/errors'

/**
 * POST /api/errors — client-side error reporting endpoint
 * ใช้โดย src/app/error.tsx (browser ส่ง error มาเก็บลง ErrorLog)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message : 'Unknown client error'
    await captureError({
      message,
      stack: typeof body?.stack === 'string' ? body.stack : undefined,
      level: 'client',
      path: typeof body?.path === 'string' ? body.path : req.nextUrl.pathname,
      userAgent: req.headers.get('user-agent') ?? undefined,
      source: 'client',
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
