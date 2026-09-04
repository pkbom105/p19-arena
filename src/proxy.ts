import { NextRequest, NextResponse } from 'next/server'

/**
 * Security proxy (Next 16 — เดิมชื่อ middleware.ts) — ใส่ security HTTP headers ให้ทุก response
 * (ไม่รวม SEO — โดยเจตนา)
 */

function securityHeaders(isDev: boolean): Record<string, string> {
  // CSP — อนุญาตเฉพาะสิ่งที่แอปใช้จริง:
  // - next/font (Google Fonts) ถูก self-host ตอน build → font-src 'self'
  // - รูปโปรไฟล์ LINE (profile.line-scdn.net) + favicon ภายนอก → img-src https:
  // - LINE token exchange เกิดฝั่ง server → client connect แค่ 'self'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')

  const headers: Record<string, string> = {
    // กัน clickjacking
    'X-Frame-Options': 'SAMEORIGIN',
    // กัน MIME-sniffing
    'X-Content-Type-Options': 'nosniff',
    // ไม่ส่ง referrer เกินจำเป็น
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // ปิด browser API ที่ไม่ใช้
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-DNS-Prefetch-Control': 'off',
    'Content-Security-Policy': csp,
  }

  // HTTPS บังคับผ่าน nginx อยู่แล้ว — บังคับ browser จำกัน downgrade
  if (!isDev) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }

  return headers
}

export function proxy(_req: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const res = NextResponse.next()
  for (const [key, value] of Object.entries(securityHeaders(isDev))) {
    res.headers.set(key, value)
  }
  return res
}

export const config = {
  // ทุก route ยกเว้น static assets (ความเร็ว — ไม่ต้อง header ซ้ำสำหรับไฟล์ static)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
