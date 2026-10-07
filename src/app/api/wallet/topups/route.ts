import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/session-auth'

const TOPUP_AMOUNTS = new Set([100, 500, 1000, 2000])
const MAX_SLIP_BYTES = 300 * 1024

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = (base64.match(/=+$/) ?? [''])[0].length
  return Math.floor((base64.length * 3) / 4) - padding
}

export async function GET(request: NextRequest) {
  const session = getCustomerSession(request)
  if (!session) return NextResponse.json({ error: 'LINE login required' }, { status: 401 })

  try {
    const requests = await db.topUpRequest.findMany({
      where: { userId: session.subject },
      select: { id: true, amount: true, status: true, createdAt: true, reviewedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json(requests)
  } catch (error) {
    console.error('Failed to load customer top-up requests', error)
    return NextResponse.json({ error: 'Failed to load top-up requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getCustomerSession(request)
  if (!session) return NextResponse.json({ error: 'LINE login required' }, { status: 401 })

  try {
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid top-up request' }, { status: 400 })
    }
    const { amount, slipName, slipDataUrl } = body as Record<string, unknown>

    if (typeof amount !== 'number' || !TOPUP_AMOUNTS.has(amount)) {
      return NextResponse.json({ error: 'Choose a valid top-up amount' }, { status: 400 })
    }
    if (
      typeof slipDataUrl !== 'string' ||
      !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(slipDataUrl)
    ) {
      return NextResponse.json({ error: 'Upload a valid JPEG or PNG payment slip' }, { status: 400 })
    }
    if (dataUrlBytes(slipDataUrl) > MAX_SLIP_BYTES) {
      return NextResponse.json({ error: 'Payment slip exceeds 300 KB' }, { status: 400 })
    }
    const safeSlipName =
      typeof slipName === 'string' && slipName.trim()
        ? slipName.trim().slice(0, 120)
        : 'payment-slip'

    const topUpRequest = await db.topUpRequest.create({
      data: {
        userId: session.subject,
        amount,
        slipName: safeSlipName,
        slipDataUrl,
      },
      select: { id: true, amount: true, status: true, createdAt: true },
    })
    return NextResponse.json(topUpRequest, { status: 201 })
  } catch (error) {
    console.error('Failed to submit customer top-up request', error)
    return NextResponse.json({ error: 'Failed to submit top-up request' }, { status: 500 })
  }
}
