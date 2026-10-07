'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Check, Coins, Loader2, UserRound, Wallet, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecentBookingsTable } from './recent-bookings-table'
import { RecentTopupsTable, type RecentTopUpRow } from './recent-topups-table'
import { TopupCardsPanel } from './topup-cards-panel'
import type { SlipVerifyPayload } from '@/components/slip2go-qr'
import type { LineMember } from './types'
import type { BookingRow } from '@/components/pos/types'

interface TopUpRequest {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  slipName: string
  slipDataUrl: string
  createdAt: string
  reviewedAt: string | null
  user: {
    id: string
    lineDisplayName: string | null
    name: string | null
    phone: string | null
    linePictureUrl: string | null
  }
}

type WalletMember = LineMember & { walletBalance: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isLineMember(value: unknown): value is WalletMember {
  if (!isRecord(value) || !isRecord(value._count)) return false

  return (
    typeof value.id === 'string' &&
    isNullableString(value.lineUserId) &&
    isNullableString(value.lineDisplayName) &&
    isNullableString(value.linePictureUrl) &&
    isNullableString(value.name) &&
    isNullableString(value.phone) &&
    isNullableString(value.email) &&
    typeof value.walletBalance === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value._count.bookings === 'number'
  )
}

/** ตรวจขั้นต่ำว่ารายการจาก /api/bookings มีฟิลด์ที่ตาราง/ตั๋วต้องใช้ครบ */
function isRecentBooking(value: unknown): value is BookingRow {
  if (!isRecord(value) || !isRecord(value.court) || !isRecord(value.timeSlot)) return false

  return (
    typeof value.id === 'string' &&
    (value.ticketCode === undefined || value.ticketCode === null || typeof value.ticketCode === 'string') &&
    typeof value.courtId === 'string' &&
    typeof value.timeSlotId === 'string' &&
    typeof value.bookingDate === 'string' &&
    typeof value.status === 'string' &&
    typeof value.playerName === 'string' &&
    typeof value.playerPhone === 'string' &&
    isNullableString(value.playerEmail) &&
    isNullableString(value.note) &&
    typeof value.racketCount === 'number' &&
    typeof value.court.id === 'string' &&
    typeof value.court.name === 'string' &&
    typeof value.timeSlot.id === 'string' &&
    typeof value.timeSlot.startTime === 'string' &&
    typeof value.timeSlot.endTime === 'string'
  )
}

/** Admin wallet profiles and pending top-up request review. */
export function TopupSection() {
  const [members, setMembers] = useState<WalletMember[]>([])
  const [requests, setRequests] = useState<TopUpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)
  const [recentBookings, setRecentBookings] = useState<BookingRow[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  /** รายการ Top-up ล่าสุดจาก DB (ทุกสถานะ) — ใช้กับตาราง "รายการ Top-up ล่าสุด" */
  const [recentTopups, setRecentTopups] = useState<RecentTopUpRow[]>([])

  const loadAdminData = async () => {
    const [requestResponse, memberResponse] = await Promise.all([
      fetch(apiUrl('/api/admin/topups'), { cache: 'no-store' }),
      fetch(apiUrl('/api/admin/wallets'), { cache: 'no-store' }),
    ])
    if (!requestResponse.ok) throw new Error('Unable to load top-up requests')
    if (!memberResponse.ok) throw new Error('Unable to load customer profiles')

    const requestData: unknown = await requestResponse.json()
    const memberData: unknown = await memberResponse.json()
    if (
      !Array.isArray(requestData) ||
      !Array.isArray(memberData) ||
      !memberData.every(isLineMember)
    ) {
      throw new Error('Invalid wallet dashboard response')
    }
    setRequests(requestData as TopUpRequest[])
    setMembers(memberData)
  }

  /**
   * โหลดรายการ Top-up ล่าสุดทุกสถานะ (pending/approved/rejected) — ตารางล่าสุดต้องเห็นแถวที่อนุมัติไปแล้วด้วย
   * ส่งข้อมูลครบทั้งหมดให้ตาราง แล้วให้ตารางแบ่งหน้าเอง (หน้าละ 5 แถว ไม่ต้องยิง API เพิ่ม)
   */
  const loadRecentTopups = async () => {
    const response = await fetch(apiUrl('/api/admin/topups?scope=recent'), { cache: 'no-store' })
    if (!response.ok) throw new Error('Unable to load recent top-ups')
    const data: unknown = await response.json()
    if (!Array.isArray(data)) throw new Error('Invalid recent top-ups response')
    setRecentTopups(data as RecentTopUpRow[])
  }

  /** โหลดรายการจองทั้งหมด แยกอิสระจากข้อมูลกระเป๋าเงิน — ล้มเหลวไม่กระทบส่วนอื่น (ตารางแบ่งหน้าเอง) */
  const loadRecentBookings = async () => {
    try {
      const response = await fetch(apiUrl('/api/bookings'), { cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load bookings')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Invalid bookings response')
      setRecentBookings(data.filter(isRecentBooking))
    } catch (err) {
      console.error('Failed to load recent bookings', err)
    } finally {
      setBookingsLoading(false)
    }
  }

  /**
   * บันทึกสลิปที่แนบจากแผงขวาลง DB โดยผูกกับลูกค้า (userId) สถานะตั้งต้น = pending
   * — พอกดอนุมัติในตาราง ยอดจะเข้ากระเป๋าลูกค้าคนนั้นจริง
   */
  const handleSlipConfirmed = async (info: {
    userId: string
    amount: number
    slipName: string
    slipDataUrl: string
    verify: SlipVerifyPayload | null
  }): Promise<{ ok: boolean; error?: string }> => {
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/admin/topups'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          isRecord(result) && typeof result.error === 'string' ? result.error : 'Unable to save top-up request'
        // 409 = สลิปซ้ำ → ให้แผงขวาโชว์เหตุผลคู่กับไฟล์ที่เลือก (ไม่ขึ้นแบนเนอร์ใหญ่ทับทั้งหน้า)
        if (response.status !== 409) setError(message)
        return { ok: false, error: message }
      }
      await Promise.all([loadRecentTopups(), loadAdminData()])
      return { ok: true }
    } catch (err) {
      console.error('Failed to save counter top-up', err)
      const message = err instanceof Error ? err.message : 'Unable to save top-up request'
      setError(message)
      return { ok: false, error: message }
    }
  }

  /** อนุมัติจากตาราง "รายการ Top-up ล่าสุด" — PATCH ให้ยอดเข้ากระเป๋าลูกค้า แล้วโหลดข้อมูลใหม่ */
  const handleApproveTopup = (row: RecentTopUpRow) => {
    void reviewRequest(row.id, 'approve')
  }

  useEffect(() => {
    const load = async () => {
      try {
        await loadAdminData()
      } catch (err) {
        console.error('Failed to load wallet dashboard', err)
        setError('Unable to load wallet dashboard. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    void load()
    void loadRecentBookings()
    void loadRecentTopups().catch((err) => console.error('Failed to load recent top-ups', err))
  }, [])

  const reviewRequest = async (id: string, action: 'approve' | 'reject') => {
    setBusyRequestId(id)
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/admin/topups'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Unable to review request'
        throw new Error(message)
      }
      await Promise.all([loadAdminData(), loadRecentTopups()])
    } catch (err) {
      console.error('Failed to review wallet top-up', err)
      setError(err instanceof Error ? err.message : 'Unable to review request')
    } finally {
      setBusyRequestId(null)
    }
  }

  const formatBalance = (balance: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(balance)

  /** สรุปสำหรับการ์ดเมนู 3 ใบ — คำนวณจากข้อมูลที่โหลดอยู่แล้ว (ไม่เพิ่ม API) */
  const bookingsTotal = members.reduce((sum, member) => sum + member._count.bookings, 0)
  const balanceTotal = members.reduce((sum, member) => sum + member.walletBalance, 0)
  const pendingAmount = requests.reduce((sum, request) => sum + request.amount, 0)
  /** โหลดเสร็จและมีข้อมูลจริง — ระหว่างโหลด/โหลดพลาดจะแสดง “—” ไม่โชว์ 0 หลอกตา */
  const statsReady = !loading && !(error && members.length === 0 && requests.length === 0)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Top up</h1>
          <p className="text-sm text-muted-foreground">Customer wallets and payment review</p>
        </div>
      </div>

      {/* การ์ดเมนู 3 ใบ (สไตล์ dashboard) — กดเพื่อไปรายการ/ส่วนที่เกี่ยวข้อง */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/1/booking"
          className="rounded-xl border bg-white p-4 transition-colors hover:bg-emerald-50/60"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-600" /> รายการจอง
          </div>
          <div className="mt-1 text-2xl font-bold">{statsReady ? bookingsTotal.toLocaleString() : '—'}</div>
          <div className="text-xs text-muted-foreground">การจองของลูกค้า LINE</div>
        </Link>

        <a
          href="#topup-requests"
          className="rounded-xl border bg-white p-4 transition-colors hover:bg-emerald-50/60"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-amber-600" /> Top-Up
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{statsReady ? requests.length.toLocaleString() : '—'}</div>
          <div className="text-xs text-muted-foreground">
            {statsReady ? `รออนุมัติ ${formatBalance(pendingAmount)}` : 'คำขอเติมเงินที่รอตรวจสอบ'}
          </div>
        </a>

        <a
          href="#customer-wallets"
          className="rounded-xl border bg-white p-4 transition-colors hover:bg-emerald-50/60"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-emerald-700" /> ยอดเงินคงเหลือ
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{statsReady ? formatBalance(balanceTotal) : '฿0'}</div>
          <div className="text-xs text-muted-foreground">รวมทุกกระเป๋าเงิน</div>
        </a>
      </div>

      {/* ใต้การ์ด 3 ใบ — แบ่ง 60/40: ซ้าย = ตารางรายการ, ขวา = Top Up Card + QR Payment */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <RecentBookingsTable bookings={recentBookings} loading={bookingsLoading} />
          <RecentTopupsTable requests={recentTopups} loading={loading} error={error} onApprove={handleApproveTopup} approvingId={busyRequestId} />
        </div>
        <div className="lg:col-span-2">
          <TopupCardsPanel members={members} onConfirmed={handleSlipConfirmed} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" role="status">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
          <span className="sr-only">Loading customer wallets</span>
        </div>
      ) : error && members.length === 0 && requests.length === 0 ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <>
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div id="topup-requests" className="space-y-3 scroll-mt-20">
            <h2 className="font-semibold">Top-up requests</h2>
            {requests.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No top-up requests yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {requests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between gap-3 text-base">
                        <span className="truncate">{request.user.lineDisplayName || request.user.name || 'LINE member'}</span>
                        <span className="shrink-0 text-emerald-700">{formatBalance(request.amount)}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {request.user.phone || 'No phone'} · {new Date(request.createdAt).toLocaleString('th-TH')}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <a href={request.slipDataUrl} target="_blank" rel="noreferrer">
                        <img src={request.slipDataUrl} alt={`Payment slip from ${request.user.lineDisplayName || request.user.name || 'customer'}`} className="max-h-64 w-full rounded-lg border object-contain" />
                      </a>
                      <p className="text-xs text-muted-foreground">{request.slipName}</p>
                      {request.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={busyRequestId === request.id}
                            onClick={() => reviewRequest(request.id, 'approve')}
                          >
                            {busyRequestId === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Approve and credit
                          </Button>
                          <Button
                            variant="outline"
                            className="text-destructive"
                            disabled={busyRequestId === request.id}
                            onClick={() => reviewRequest(request.id, 'reject')}
                          >
                            <X className="mr-2 h-4 w-4" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <p className={request.status === 'approved' ? 'text-sm font-medium text-emerald-700' : 'text-sm font-medium text-destructive'}>
                          {request.status === 'approved' ? 'Approved and credited' : 'Rejected'}
                          {request.reviewedAt && ` · ${new Date(request.reviewedAt).toLocaleString('th-TH')}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div id="customer-wallets" className="space-y-3 scroll-mt-20">
            <h2 className="font-semibold">Customer wallets</h2>
            {members.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No customers yet.
        </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {members.map((member) => {
                  const displayName = member.lineDisplayName || member.googleName || member.name || 'Customer'
                  const avatar = member.linePictureUrl || member.googlePictureUrl || null
                  const channels = [
                    member.lineUserId ? 'LINE' : null,
                    member.googleId ? 'Google' : null,
                  ].filter((c): c is string => Boolean(c))

                  return (
                    <Card key={member.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="flex min-w-0 items-center gap-3 text-base">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <UserRound className="h-5 w-5" />
                            </span>
                          )}
                          <span className="truncate">{displayName}</span>
                        </CardTitle>
                        {channels.length > 0 && (
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {channels.map((channel) => (
                              <span
                                key={channel}
                                className={channel === 'LINE'
                                  ? 'rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] text-green-700'
                                  : 'rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600'}
                              >
                                {channel}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground">Name</dt>
                            <dd className="truncate">{member.name || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Phone</dt>
                            <dd className="truncate">{member.phone || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Email</dt>
                            <dd className="truncate">{member.email || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Bookings</dt>
                            <dd>{member._count.bookings}</dd>
                          </div>
                        </dl>

                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                          <span className="flex items-center gap-2 text-sm text-emerald-800">
                            <Wallet className="h-4 w-4" />
                            Wallet balance
                          </span>
                          <span className="font-semibold text-emerald-900">
                            {formatBalance(member.walletBalance)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}