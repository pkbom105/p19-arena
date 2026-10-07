'use client'

import { useCallback, useRef, useState } from 'react'
import { apiUrl } from '@/lib/api'

/**
 * Slip2Go — component/ฟังก์ชันกลางสำหรับ "ตรวจสลิป"
 * รวม logic + UI ที่เดิมเขียนซ้ำใน step-confirm (step 4 ลูกค้า) และ topup-cards-panel (Upload Slip แอดมิน)
 * จุดสำคัญ: secret อยู่ฝั่ง server เท่านั้น — client เรียกผ่าน /api/slip/verify
 */

/** ผลตรวจสลิป (normalize ให้ UI ใช้ง่าย) */
export interface SlipVerifyOutcome {
  state: 'idle' | 'loading' | 'ok' | 'fail' | 'error'
  /** รหัสผลจาก Slip2Go เช่น 200000 */
  code: string | null
  /** ข้อความจาก Slip2Go */
  message: string | null
  /** ยอดเงินที่อ่านได้จากสลิป */
  amount: number | null
  amountMatches: boolean | null
  /** ผู้รับ (Slip2Go มาสก์เลขบัญชี เช่น xxx-xxx-3979 · ชื่อ) */
  receiverName: string | null
  receiverMatches: boolean | null
  /** เลขอ้างอิงธุรกรรมจากธนาคาร */
  transRef: string | null
  transDate: string | null
  /** ข้อความสรุปไว้แสดงบนจอ */
  label?: string
}

/** ผลตรวจที่จะส่งไปบันทึกลง DB */
export interface SlipVerifyPayload {
  status: 'ok' | 'fail' | 'error'
  code: string | null
  amount: number | null
  receiver: string | null
  transRef: string | null
}

const IDLE: SlipVerifyOutcome = {
  state: 'idle',
  code: null,
  message: null,
  amount: null,
  amountMatches: null,
  receiverName: null,
  receiverMatches: null,
  transRef: null,
  transDate: null,
}

interface VerifyApiResponse {
  ok?: boolean
  error?: string
  code?: string | null
  message?: string | null
  found?: boolean
  duplicate?: boolean
  amount?: number | null
  amountMatches?: boolean | null
  receiverText?: string | null
  receiverMatches?: boolean | null
  transRef?: string | null
  transDate?: string | null
}

/** เรียก /api/slip/verify (ฝั่ง server) แล้ว normalize ผลเป็น outcome เดียว */
export async function verifySlipSlip2Go(
  slipDataUrl: string,
  expectedAmount?: number
): Promise<SlipVerifyOutcome> {
  try {
    const res = await fetch(apiUrl('/api/slip/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slipDataUrl, expectedAmount }),
    })
    const data = (await res.json().catch(() => null)) as VerifyApiResponse | null
    if (!res.ok || !data || data.ok === false) {
      const message = data?.error || 'ตรวจสลิปไม่สำเร็จ'
      return { ...IDLE, state: 'error', message, label: message }
    }

    const base: SlipVerifyOutcome = {
      state: 'idle',
      code: data.code ?? null,
      message: data.message ?? null,
      amount: data.amount ?? null,
      amountMatches: data.amountMatches ?? null,
      receiverName: data.receiverText ?? null,
      receiverMatches: data.receiverMatches ?? null,
      transRef: data.transRef ?? null,
      transDate: data.transDate ?? null,
    }

    if (data.duplicate) {
      return {
        ...base,
        state: 'fail',
        label: data.message ? `สลิปซ้ำ (${data.message})` : 'สลิปซ้ำ — ถูกใช้ไปแล้ว',
      }
    }
    if (!data.found) {
      return {
        ...base,
        state: 'fail',
        label: data.message ? `ไม่พบสลิป (${data.message})` : 'ไม่พบสลิปในระบบธนาคาร',
      }
    }
    if (data.amountMatches === false) {
      return {
        ...base,
        state: 'fail',
        label: `ยอดในสลิปไม่ตรง — สลิป ฿${data.amount} / ต้อง ฿${expectedAmount}`,
      }
    }
    if (data.receiverMatches === false) {
      return { ...base, state: 'fail', label: 'บัญชีผู้รับในสลิปไม่ใช่บัญชีร้าน' }
    }
    return { ...base, state: 'ok', label: `สลิปถูกต้อง (ยอด ฿${data.amount})` }
  } catch (error) {
    console.error('Slip verify failed', error)
    const message = 'ตรวจสลิปไม่สำเร็จ'
    return { ...IDLE, state: 'error', message, label: message }
  }
}

/**
 * hook จัดการสถานะ — run() ตอนเลือกไฟล์, reset() ตอนลบ/เปลี่ยนสลิป
 * (ให้ runId กันผลลัพธ์เก่ามาทับผลใหม่เมื่อเลือกไฟล์รัว ๆ)
 */
export function useSlip2GoVerify(onResult?: (outcome: SlipVerifyOutcome) => void) {
  const [status, setStatus] = useState<SlipVerifyOutcome>(IDLE)
  const runIdRef = useRef(0)

  const run = useCallback(
    async (slipDataUrl: string, expectedAmount?: number) => {
      const runId = ++runIdRef.current
      setStatus({ ...IDLE, state: 'loading' })
      const outcome = await verifySlipSlip2Go(slipDataUrl, expectedAmount)
      if (runId !== runIdRef.current) return outcome
      setStatus(outcome)
      if (outcome.state !== 'idle' && outcome.state !== 'loading') onResult?.(outcome)
      return outcome
    },
    [onResult]
  )

  const reset = useCallback(() => {
    runIdRef.current++
    setStatus(IDLE)
  }, [])

  return { status, run, reset }
}

/** แปลงผลตรวจ → payload สำหรับบันทึกลง DB (null ถ้ายังไม่เสร็จ) */
export function toSlipVerifyPayload(outcome: SlipVerifyOutcome): SlipVerifyPayload | null {
  if (outcome.state === 'idle' || outcome.state === 'loading') return null
  return {
    status: outcome.state,
    code: outcome.code,
    amount: outcome.amount,
    receiver: outcome.receiverName,
    transRef: outcome.transRef,
  }
}

/** บรรทัดสถานะการตรวจสลิป — ⏳ กำลังตรวจ / ✅ ผ่าน / ❌ ไม่ผ่าน / ⚠️ ตรวจไม่สำเร็จ */
export function Slip2GoStatus({
  status,
  prefix = 'ตรวจสลิป',
}: {
  status: SlipVerifyOutcome
  prefix?: string
}) {
  if (status.state === 'idle') return null
  const className =
    status.state === 'ok'
      ? 'text-xs text-emerald-700'
      : status.state === 'loading'
        ? 'text-xs text-muted-foreground'
        : status.state === 'error'
          ? 'text-xs text-amber-600'
          : 'text-xs text-red-500'
  const text =
    status.state === 'loading'
      ? 'กำลังตรวจสลิปกับธนาคาร…'
      : status.state === 'ok'
        ? `✅ ${prefix}: ${status.label}`
        : status.state === 'error'
          ? `⚠️ ตรวจสลิปไม่สำเร็จ (${status.label})`
          : `❌ ${prefix}: ${status.label}`
  return (
    <p className={className} data-field="slip-verify-status" data-state={status.state}>
      {text}
    </p>
  )
}
