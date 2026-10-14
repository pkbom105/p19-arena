'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Pencil, ShieldCheck, Trash2, UserRound, Wallet } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePagination, paginate } from './table-pagination'
import { PROFILE_LEVELS, profileLevelInfo } from '@/lib/permissions'
import type { LineMember } from './types'

type WalletMember = Omit<LineMember, '_count'> & {
  walletBalance: number
  _count: { bookings: number; topUpRequests: number }
  /** การจองที่ยังไม่ถึงกำหนด (คำนวณจาก slot-time ฝั่งเซิร์ฟเวอร์) — มีแล้วลบโปรไฟล์ไม่ได้ */
  upcomingBookings?: number
  pastBookings?: number
  /** note ของโปรไฟล์ (เก็บในตาราง Settings — คีย์ user_note_<id>) */
  note?: string | null
  /** ระดับสิทธิ์: user | admin | super_admin (ตั้งได้จาก dropdown ในแถวนี้ — ดู profile.md) */
  level?: string | null
}

/** ตารางนี้แสดง 10 โปรไฟล์ต่อหน้า (ค่ากลางของตารางอื่นคือ 5 — ไม่แก้ค่านั้น) */
const WALLET_PAGE_SIZE = 10

/** แสดงวันเวลาแบบไทย (พ.ศ.) — ใช้กับ "วันที่สร้าง" */
const formatDateTime = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatBalance = (value: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** ตรวจขั้นต่ำว่ารายการจาก /api/admin/wallets มีฟิลด์ที่ตารางต้องใช้ครบ */
function isWalletMember(value: unknown): value is WalletMember {
  if (!isRecord(value) || !isRecord(value._count)) return false
  return (
    typeof value.id === 'string' &&
    isNullableString(value.lineUserId) &&
    isNullableString(value.lineDisplayName) &&
    isNullableString(value.linePictureUrl) &&
    isNullableString(value.googleId) &&
    isNullableString(value.googleName) &&
    isNullableString(value.googlePictureUrl) &&
    isNullableString(value.name) &&
    isNullableString(value.phone) &&
    isNullableString(value.email) &&
    typeof value.walletBalance === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value._count.bookings === 'number' &&
    typeof value._count.topUpRequests === 'number' &&
    (value.upcomingBookings === undefined || typeof value.upcomingBookings === 'number') &&
    (value.note === undefined || isNullableString(value.note)) &&
    (value.level === undefined || isNullableString(value.level))
  )
}

/** ชื่อที่ใช้แสดง — LINE ก่อน แล้ว Google แล้วชื่อที่กรอกไว้ */
function memberName(member: WalletMember): string {
  return member.lineDisplayName || member.googleName || member.name || 'Customer'
}

function memberAvatar(member: WalletMember): string | null {
  return member.linePictureUrl || member.googlePictureUrl || null
}

/** ช่องทางที่ผูกไว้ — ใช้แสดงคอลัมน์ Login status */
function loginChannels(member: WalletMember): string[] {
  return [member.lineUserId ? 'LINE' : null, member.googleId ? 'Google' : null].filter(
    (channel): channel is string => Boolean(channel)
  )
}

/** แถวข้อมูลที่ส่งกลับหลัง PATCH สำเร็จ */
interface UpdatedMember {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}


/**
 * ตาราง "Customer wallets" — ย้ายมาจากหน้า /dashboard/1/topup (เดิมเป็นการ์ดกริด)
 * แสดง: ข้อมูลโปรไฟล์ · ช่องทางล็อกอิน · ยอดเงินคงเหลือ · ปุ่มแก้ไข/ลบ
 * ลบได้เฉพาะโปรไฟล์ที่ "ไม่มีการจอง และยอดเงิน = 0" (เซิร์ฟเวอร์เป็นผู้ตรวจซ้ำ — ฝั่ง UI แค่เตือนล่วงหน้า)
 */
export function CustomerWalletsTable() {
  const [members, setMembers] = useState<WalletMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState<WalletMember | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<WalletMember | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  /** แถวที่ขยายอยู่ (Collapsible) — null = ไม่มีแถวไหนขยาย */
  const [expandedId, setExpandedId] = useState<string | null>(null)
  /** แถวที่กำลังแก้ "profile note" (ตาม id) + ข้อความฉบับร่าง */
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  /** แถวที่กำลังบันทึก "ระดับสิทธิ์" อยู่ (id) — ปิด dropdown/ปุ่มชั่วคราว */
  const [levelBusyId, setLevelBusyId] = useState<string | null>(null)
  /** draft ระดับสิทธิ์ต่อแถว (id → level ที่เลือกไว้ ยังไม่กดบันทึก) */
  const [levelDrafts, setLevelDrafts] = useState<Record<string, string>>({})

  /** ระดับที่แสดงใน dropdown — ใช้ draft (ถ้ามี) ไม่เช่นนั้นใช้ค่าจริงจากเซิร์ฟเวอร์ */
  const levelValueOf = (member: WalletMember) => levelDrafts[member.id] ?? profileLevelInfo(member.level).level
  /** true = เลือกเปลี่ยนไว้แล้วแต่ยังไม่กดบันทึก (ใช้ปิด/เปิดปุ่มบันทึก) */
  const levelDirty = (member: WalletMember) =>
    levelDrafts[member.id] !== undefined && levelDrafts[member.id] !== profileLevelInfo(member.level).level

  const load = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch(apiUrl('/api/admin/wallets'), { cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load customer profiles')
      const data: unknown = await response.json()
      if (!Array.isArray(data) || !data.every(isWalletMember)) {
        throw new Error('Invalid wallet dashboard response')
      }
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load customer profiles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { rows, totalPages, currentPage } = paginate(members, page, WALLET_PAGE_SIZE)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openEdit = (member: WalletMember) => {
    setNotice(null)
    setEditing(member)
    setForm({ name: member.name ?? '', phone: member.phone ?? '', email: member.email ?? '' })
  }

  /** เริ่มแก้ note ของแถวนี้ (โหมด view → edit) */
  const startNoteEdit = (member: WalletMember) => {
    setNotice(null)
    setNoteEditingId(member.id)
    setNoteDraft(member.note ?? '')
  }

  /** บันทึก note (PATCH /api/admin/wallets — เก็บในตาราง Settings) */
  const saveNote = async (member: WalletMember) => {
    setNoteSaving(true)
    setNotice(null)
    try {
      const response = await fetch(apiUrl('/api/admin/wallets'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, note: noteDraft }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'บันทึก note ไม่สำเร็จ'
        throw new Error(message)
      }
      const saved = isRecord(payload) && (payload.note === null || typeof payload.note === 'string') ? (payload.note as string | null) : null
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, note: saved } : m)))
      setNoteEditingId(null)
      setNotice(`บันทึก note ของ ${memberName(member)} แล้ว`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'บันทึก note ไม่สำเร็จ')
    } finally {
      setNoteSaving(false)
    }
  }

  /**
   * ตั้งระดับสิทธิ์ของโปรไฟล์ (Profile level) — PATCH /api/admin/wallets
   * เซิร์ฟเวอร์ตรวจสิทธิ์ซ้ำ (ต้องเป็น admin ขึ้นไป · super admin เท่านั้นที่ตั้ง super_admin ได้)
   */
  const changeLevel = async (member: WalletMember, level: string) => {
    setLevelBusyId(member.id)
    setNotice(null)
    try {
      const response = await fetch(apiUrl('/api/admin/wallets'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, level }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'ตั้งระดับสิทธิ์ไม่สำเร็จ'
        throw new Error(message)
      }
      const saved = isRecord(payload) && typeof payload.level === 'string' ? payload.level : level
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, level: saved } : m)))
      // เคลียร์ draft ของแถวนี้ — dropdown จะกลับไปแสดงค่าที่บันทึกจริง
      setLevelDrafts((prev) => {
        const next = { ...prev }
        delete next[member.id]
        return next
      })
      setNotice(`ตั้งระดับสิทธิ์ของ ${memberName(member)} เป็น ${profileLevelInfo(saved).label} แล้ว`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ตั้งระดับสิทธิ์ไม่สำเร็จ')
    } finally {
      setLevelBusyId(null)
    }
  }

  const submitEdit = async () => {
    if (!editing) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch(apiUrl('/api/admin/wallets'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'บันทึกไม่สำเร็จ'
        throw new Error(message)
      }
      const updated = payload as UpdatedMember
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)))
      setNotice(`บันทึกโปรไฟล์ของ ${updated.name || 'สมาชิก'} แล้ว`)
      setEditing(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    setNotice(null)
    try {
      const response = await fetch(apiUrl(`/api/admin/wallets?id=${encodeURIComponent(deleting.id)}`), {
        method: 'DELETE',
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'ลบไม่สำเร็จ'
        throw new Error(message)
      }
      setMembers((prev) => prev.filter((m) => m.id !== deleting.id))
      setNotice(`ลบโปรไฟล์ของ ${memberName(deleting)} แล้ว`)
      setDeleting(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
      setDeleting(null)
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Customer profiles and wallet balances</p>
      </div>

      {error && members.length === 0 ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-emerald-600" />
            Customer Profile
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {loading ? 'กำลังโหลด…' : `${members.length.toLocaleString()} โปรไฟล์`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <span className="sr-only">Loading customer profiles</span>
            </div>
          ) : members.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No customers yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>โปรไฟล์</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>จอง</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((member) => {
                    const avatar = memberAvatar(member)
                    const channels = loginChannels(member)
                    const upcoming = member.upcomingBookings ?? 0
                    /** เหตุผลที่ลบไม่ได้ (null = ลบได้) — เกณฑ์เดียวกับที่เซิร์ฟเวอร์ตรวจ */
                    const lockReason =
                      upcoming > 0
                        ? `มีการจองที่ยังไม่ถึงกำหนด ${upcoming} รายการ`
                        : member.walletBalance !== 0
                          ? `กระเป๋ายังมียอดเงิน ${formatBalance(member.walletBalance)}`
                          : member._count.topUpRequests > 0
                            ? `มีประวัติเติมเงิน ${member._count.topUpRequests} รายการ`
                            : null
                    return (
                      <Fragment key={member.id}>
                      <TableRow>
                        <TableCell className="max-w-[15rem] whitespace-normal">
                          <div className="flex items-center gap-3">
                            {avatar ? (
                              <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <UserRound className="h-4 w-4" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{memberName(member)}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.phone || '—'}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.email || '—'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {channels.length === 0 ? (
                              <Badge variant="outline" className="bg-muted text-[11px] text-muted-foreground">
                                ยังไม่ผูก
                              </Badge>
                            ) : (
                              channels.map((channel) => (
                                <Badge
                                  key={channel}
                                  variant="outline"
                                  className={
                                    channel === 'LINE'
                                      ? 'border-green-200 bg-green-50 text-[11px] text-green-700'
                                      : 'border-red-200 bg-red-50 text-[11px] text-red-700'
                                  }
                                >
                                  {channel}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-700">
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="h-3.5 w-3.5" />
                            {formatBalance(member.walletBalance)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{member._count.bookings}</span>
                            {upcoming > 0 ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] text-amber-700">
                                ยังไม่ถึง {upcoming}
                              </Badge>
                            ) : member._count.bookings > 0 ? (
                              <Badge variant="outline" className="bg-muted text-[11px] text-muted-foreground">
                                ผ่านแล้ว
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 shrink-0 p-0"
                              aria-expanded={expandedId === member.id}
                              aria-label={expandedId === member.id ? 'ย่อรายละเอียด' : 'ขยายรายละเอียด'}
                              onClick={() => {
                                setNotice(null)
                                setNoteEditingId(null)
                                setExpandedId((prev) => (prev === member.id ? null : member.id))
                              }}
                            >
                              {expandedId === member.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={() => openEdit(member)}>
                              <Pencil className="h-3.5 w-3.5" />
                              แก้ไข
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 px-2 text-destructive"
                              onClick={() => {
                                setNotice(null)
                                if (lockReason) {
                                  setNotice(`ลบไม่ได้: ${memberName(member)} — ${lockReason}`)
                                  return
                                }
                                setDeleting(member)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              ลบ
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedId === member.id ? (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={5} className="whitespace-normal">
                            <Collapsible open>
                              <CollapsibleContent>
                                <div className="space-y-3 py-1">
                                  <div>
                                    <p className="text-xs text-muted-foreground">วันที่สร้าง (Create date)</p>
                                    <p className="text-sm">{formatDateTime(member.createdAt)}</p>
                                  </div>
                                  {/* ระดับสิทธิ์ (Profile level) — dropdown ตั้งสิทธิ์ผู้ใช้ (ดู profile.md) */}
                                  <div className="mx-[50px] space-y-2">
                                    <div className="flex items-center gap-1.5">
                                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                      <p className="text-xs text-muted-foreground">ระดับสิทธิ์ (Profile level)</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Select
                                        value={levelValueOf(member)}
                                        onValueChange={(value) => setLevelDrafts((prev) => ({ ...prev, [member.id]: value }))}
                                        disabled={levelBusyId === member.id}
                                      >
                                        <SelectTrigger
                                          className="h-8 w-[170px] text-sm"
                                          aria-label={`ระดับสิทธิ์ของ ${memberName(member)}`}
                                          data-field="profile-level"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PROFILE_LEVELS.map((info) => (
                                            <SelectItem key={info.level} value={info.level}>
                                              {info.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                        disabled={levelBusyId === member.id || !levelDirty(member)}
                                        onClick={() => void changeLevel(member, levelValueOf(member))}
                                      >
                                        {levelBusyId === member.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                        บันทึก
                                      </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                      {profileLevelInfo(member.level).desc}
                                      {' '}· เลือกระดับแล้วกด &quot;บันทึก&quot; เพื่อยืนยัน (ปุ่มจะเปิดเมื่อมีการเปลี่ยนค่า)
                                    </p>
                                  </div>

                                  <div className="mx-[50px] space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs text-muted-foreground">Profile note</p>
                                      {noteEditingId === member.id ? null : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 gap-1 px-2"
                                          onClick={() => startNoteEdit(member)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                          แก้ไข
                                        </Button>
                                      )}
                                    </div>
                                    {noteEditingId === member.id ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={noteDraft}
                                          onChange={(event) => setNoteDraft(event.target.value)}
                                          rows={3}
                                          maxLength={500}
                                          placeholder="บันทึกช่วยจำของโปรไฟล์นี้ (สูงสุด 500 ตัวอักษร)"
                                          className="bg-background"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                            disabled={noteSaving}
                                            onClick={() => saveNote(member)}
                                          >
                                            {noteSaving ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Check className="h-3.5 w-3.5" />
                                            )}
                                            บันทึก
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8"
                                            disabled={noteSaving}
                                            onClick={() => setNoteEditingId(null)}
                                          >
                                            ยกเลิก
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="whitespace-pre-wrap text-sm">
                                        {member.note && member.note.trim() ? member.note : '—'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={currentPage}
                pageSize={WALLET_PAGE_SIZE}
                total={members.length}
                itemLabel="โปรไฟล์"
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
      {/* แก้ไขโปรไฟล์ */}
      <Dialog open={!!editing} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขโปรไฟล์</DialogTitle>
            <DialogDescription>{editing ? memberName(editing) : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wallet-name" className="text-xs text-muted-foreground">
                ชื่อ
              </Label>
              <Input id="wallet-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-phone" className="text-xs text-muted-foreground">
                เบอร์โทร
              </Label>
              <Input id="wallet-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-email" className="text-xs text-muted-foreground">
                อีเมล
              </Label>
              <Input id="wallet-email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={submitEdit}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ยืนยันลบ — เปิดได้เฉพาะกรณีไม่มีการจองและยอดเงิน 0 (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น) */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => (open ? null : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              ลบโปรไฟล์นี้?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${memberName(deleting)} — ไม่มีการจองที่ยังไม่ถึงกำหนด · ยอดเงิน 0 · ไม่มีประวัติเติมเงิน · การจองที่ผ่านแล้วจะยังคงอยู่ในระบบ (เพียงตัดความเชื่อมโยงกับโปรไฟล์)`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingBusy}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {deletingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              ลบโปรไฟล์
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
