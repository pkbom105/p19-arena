import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const CUSTOMER_SESSION_COOKIE = 'p19_customer_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

interface SessionPayload {
  role: 'customer'
  subject: string
  expiresAt: number
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be configured with at least 32 characters')
  }
  return secret
}

function signature(value: string): string {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url')
}

export function createSessionToken(subject: string): string {
  const payload: SessionPayload = {
    role: 'customer',
    subject,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null

  const [encoded, suppliedSignature, extra] = token.split('.')
  if (!encoded || !suppliedSignature || extra !== undefined) return null

  let expectedSignature: string
  try {
    expectedSignature = signature(encoded)
  } catch (error) {
    console.error('Session authentication is not configured', error)
    return null
  }

  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  try {
    const payload: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('role' in payload) ||
      !('subject' in payload) ||
      !('expiresAt' in payload) ||
      payload.role !== 'customer' ||
      typeof payload.subject !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }
    return payload as SessionPayload
  } catch {
    return null
  }
}

export function setSessionCookie(
  response: NextResponse,
  name: typeof CUSTOMER_SESSION_COOKIE,
  subject: string
): void {
  response.cookies.set(name, createSessionToken(subject), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function getCustomerSession(request: NextRequest): SessionPayload | null {
  return readSessionToken(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value)
}
