'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Loader2, QrCode, ScanText, UploadCloud, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generatePromptPayQR } from '@/components/qrcode'
import { useSlip2GoVerify, Slip2GoStatus, toSlipVerifyPayload, type SlipVerifyOutcome, type SlipVerifyPayload } from '@/components/slip2go-qr'
import { CASH_CARDS } from '@/lib/cash-cards'
import { MAX_SLIP_SIZE } from './slip-helpers'

const formatBaht = (value: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)

/** ดึงยอดเงินที่น่าจะใช่จากข้อความที่ OCR อ่านได้ — เลือกจำนวนที่มีทศนิยม (.xx) ก่อน แล้วเอาค่ามากสุด */
function extractSlipAmount(text: string): number | null {
  const withDecimals = (text.match(/\d[\d,]*\.\d{1,2}/g) ?? [])
    .map((m) => Number(m.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (withDecimals.length) return Math.max(...withDecimals)
  const integers = (text.match(/\d[\d,]*/g) ?? [])
    .map((m) => Number(m.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 1)
  return integers.length ? Math.max(...integers) : null
}

interface TopupCustomer {
  id: string
  lineUserId: string | null
  lineDisplayName: string | null
  name: string | null
  phone: string | null
}

interface TopupCardsPanelProps {
  /** ลูกค้า LINE ที่ผูกกระเป๋าเงิน (userId ใน DB) — ใช้เลือกว่าเงินจะเข้าคนไหน (โหมดเจ้าหน้าที่) */
  members?: TopupCustomer[]
  /**
   * เรียกหลังยืนยันสลิป — ส่งยอด + userId ของลูกค้าที่ผูก ไปบันทึกใน "รายการ Top-up ล่าสุด"
   * คืน { ok: false, error } เมื่อบันทึกไม่ได้ (เช่น สลิปซ้ำ) เพื่อให้แผงโชว์เหตุผลและคงไฟล์ไว้ให้เปลี่ยน
   */
  onConfirmed?: (info: {
    userId: string
    /** การ์ดที่เลือก — ฝั่งเซิร์ฟเวอร์ใช้คิดยอดเครดิตเอง (ห้ามเชื่อยอดจาก client) */
    cardId: string
    amount: number
    slipName: string
    slipDataUrl: string
    /** ผลตรวจสลิป (Slip2Go) — ไว้บันทึกใน DB */
    verify: SlipVerifyPayload | null
  }) => Promise<{ ok: boolean; error?: string }>
  /**
   * โหมดการใช้งาน: 'staff' (ค่าเริ่มต้น — หน้า /dashboard/1/topup เลือกลูกค้าได้)
   * หรือ 'member' (หน้า /member/profile/wallet — ใช้สมาชิกที่ล็อกอินอยู่ ไม่มีตัวเลือกลูกค้า)
   */
  mode?: 'staff' | 'member'
  /** userId ของสมาชิกที่ล็อกอินอยู่ (ใช้ตอน mode = 'member') */
  selfUserId?: string
}

/**
 * แผงขวาของหน้า Top up (/dashboard/1/topup)
 * เลือก Cash Card แล้วกด "สร้าง QR Payment" → แสดง QR พร้อมเพย์ของยอดที่ต้องจ่าย (display view)
 * และช่อง "UPLOAD FILE" — เลือกสลิปแล้ว OCR อ่านยอดเงินในเครื่อง (tesseract.js, ไม่ใช้ AI token)
 */

export function TopupCardsPanel({ members, onConfirmed, mode = 'staff', selfUserId }: TopupCardsPanelProps) {
  const [selectedId, setSelectedId] = useState(CASH_CARDS[0].id)
  /** ลูกค้า (userId ใน DB) ที่จะผูกสลิปด้วย — เงินจะเข้าถูกระเป๋าคนนี้หลังอนุมัติ */
  const [customerId, setCustomerId] = useState('')
  /** กำลังบันทึกสลิปลง DB (ปิดปุ่มยืนยันชั่วคราว) */
  const [slipSaving, setSlipSaving] = useState(false)
  /** ไฟล์สลิปที่เลือกไว้ในช่อง "UPLOAD FILE" */
  const [slipDataUrl, setSlipDataUrl] = useState<string | null>(null)
  const [slipName, setSlipName] = useState<string | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)
  /** ยอด Top-up ที่ยืนยันแล้ว (get ของ Cash Card ที่เลือก) — null = ยังไม่ยืนยัน */
  const [slipConfirmed, setSlipConfirmed] = useState<number | null>(null)
  const slipInputRef = useRef<HTMLInputElement>(null)
  /** ยอดเงินที่ OCR อ่านได้จากรูปสลิป */
  const [ocrAmount, setOcrAmount] = useState<number | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  /** ตรวจสลิปกับ Slip2Go (component กลาง) — เก็บผลลัพธ์ไว้ส่งไปกับ onConfirmed */
  const verifyOutcomeRef = useRef<SlipVerifyOutcome | null>(null)
  const { status: verifyStatus, run: runSlipVerify, reset: resetSlipVerify } = useSlip2GoVerify((outcome) => {
    verifyOutcomeRef.current = outcome
  })
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrAmount, setQrAmount] = useState<number | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  /**
   * โหมดสมาชิก (หน้า /member/profile/wallet) = ใช้ "ตัวเอง" อัตโนมัติ ไม่ต้องเลือก
   * โหมดเจ้าหน้าที่ (หน้า /dashboard/1/topup) = เลือกลูกค้าจาก dropdown (พฤติกรรมเดิม)
   */
  const isMemberMode = mode === 'member'
  const effectiveCustomerId = isMemberMode ? (selfUserId ?? '') : customerId

  const selected = CASH_CARDS.find((card) => card.id === selectedId) ?? CASH_CARDS[0]

  /** เปลี่ยนบัตร = ล้าง QR เดิม + ล้างสถานะยืนยันสลิป (ยอดผูกกับบัตรที่เลือก) */
  const selectCard = (id: string) => {
    setSelectedId(id)
    setQrDataUrl(null)
    setQrAmount(null)
    setSlipConfirmed(null)
    resetSlipVerify()
  }

  const generateQr = async () => {
    setQrLoading(true)
    try {
      const url = await generatePromptPayQR(selected.pay)
      setQrDataUrl(url)
      setQrAmount(selected.pay)
    } catch (error) {
      console.error('Failed to generate PromptPay QR', error)
      setQrDataUrl(null)
      setQrAmount(null)
    } finally {
      setQrLoading(false)
    }
  }

  /**
   * OCR อ่านยอดเงินจากรูปสลิป — ทำงานในเบราว์เซอร์ด้วย tesseract.js
   * (ประมวลผลในเครื่อง ไม่เรียก AI จึงไม่กิน token) — โหลดโมเดลจาก CDN ครั้งแรก
   */
  const readSlipAmount = async (dataUrl: string) => {
    setOcrLoading(true)
    setOcrAmount(null)
    setOcrError(null)
    try {
      const mod = (await import('tesseract.js')) as unknown as typeof import('tesseract.js') & {
        default?: typeof import('tesseract.js')
      }
      const Tesseract = mod.default ?? mod
      const { data } = await Tesseract.recognize(dataUrl, 'eng')
      const amount = extractSlipAmount(data.text ?? '')
      if (amount === null) setOcrError('อ่านยอดจากสลิปไม่ได้ — ลองรูปที่ชัดขึ้น')
      else setOcrAmount(amount)
    } catch (error) {
      console.error('Failed to read slip amount via OCR', error instanceof Error ? error.message : String(error))
      setOcrError('อ่านสลิปไม่สำเร็จ')
    } finally {
      setOcrLoading(false)
    }
  }

  /** เลือกไฟล์สลิปในช่อง UPLOAD FILE (ตรวจชนิด/ขนาดแบบเดียวกับหน้าอื่น) แล้วอ่านยอดด้วย OCR */
  const handleSlipFile = (file: File | null) => {
    setSlipError(null)
    setSlipConfirmed(null)
    setOcrAmount(null)
    setOcrError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setSlipError('รองรับเฉพาะไฟล์รูปภาพ (jpg / png)')
      return
    }
    if (file.size > MAX_SLIP_SIZE) {
      setSlipError(`ไฟล์ใหญ่เกินไป (สูงสุด 300kB) — ไฟล์นี้ ${Math.ceil(file.size / 1024)}kB`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      setSlipDataUrl(dataUrl)
      setSlipName(file.name)
      void readSlipAmount(dataUrl)
      void runSlipVerify(dataUrl, selected.pay)
    }
    reader.readAsDataURL(file)
  }

  const removeSlip = () => {
    setSlipDataUrl(null)
    setSlipName(null)
    setSlipError(null)
    setOcrAmount(null)
    setOcrError(null)
    resetSlipVerify()
    if (slipInputRef.current) slipInputRef.current.value = ''
  }

  /** ยืนยันสลิป — ใช้ยอดที่ OCR อ่านได้ (ถ้าอ่านไม่ได้ใช้ยอดที่ได้เข้ากระเป๋า) แล้วแจ้งหน้าหลักไปเพิ่มใน "รายการ Top-up ล่าสุด" */
  const confirmSlip = async () => {
    if (!slipDataUrl) return
    if (!effectiveCustomerId) {
      setSlipError(
        isMemberMode
          ? 'ไม่พบเซสชันสมาชิก กรุณารีเฟรชหน้าแล้วลองใหม่'
          : 'เลือกลูกค้าที่จะผูกสลิปก่อนกดยืนยัน'
      )
      return
    }
    const amount = ocrAmount ?? selected.get
    setSlipError(null)
    setSlipSaving(true)
    const result = await onConfirmed?.({
      userId: effectiveCustomerId,
      cardId: selected.id,
      amount,
      slipName: slipName ?? 'payment-slip',
      slipDataUrl,
      verify: verifyOutcomeRef.current ? toSlipVerifyPayload(verifyOutcomeRef.current) : null,
    })
    setSlipSaving(false)
    // สลิปซ้ำ / บันทึกไม่ผ่าน → คงไฟล์ไว้ให้เปลี่ยนสลิป แล้วโชว์เหตุผล ไม่ขึ้นสถานะยืนยันแล้ว
    if (result && result.ok === false) {
      setSlipError(result.error ?? 'บันทึกสลิปไม่สำเร็จ')
      return
    }
    setSlipConfirmed(amount)
    removeSlip()
  }

  /** ยกเลิก = ล้างไฟล์ที่เลือกออกจากช่อง */
  const cancelSlip = () => {
    removeSlip()
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Cash Card</h2>
      <div className="space-y-2 rounded-xl border bg-white p-3">
        {CASH_CARDS.map((card) => {
          const active = card.id === selectedId
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectCard(card.id)}
              className={
                'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                (active ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:bg-muted/50')
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <Wallet className={'h-4 w-4 shrink-0 ' + (active ? 'text-emerald-600' : 'text-muted-foreground')} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{card.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Pay {formatBaht(card.pay)} get {formatBaht(card.get)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-emerald-700">{formatBaht(card.get)}</span>
            </button>
          )
        })}

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => void generateQr()}
          disabled={qrLoading}
        >
          {qrLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />}
          สร้าง QR Payment
        </Button>

        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-3">
          {qrDataUrl ? (
            <>
              <img
                src={qrDataUrl}
                alt={`PromptPay QR ${formatBaht(qrAmount ?? selected.pay)}`}
                className="h-52 w-52 rounded-xl border p-2"
              />
              <p className="text-sm text-muted-foreground">สแกนจ่าย {formatBaht(qrAmount ?? selected.pay)}</p>
            </>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              เลือกบัตรแล้วกด “สร้าง QR Payment” เพื่อแสดง QR พร้อมเพย์
            </p>
          )}
        </div>
      </div>

      {/* Upload Slip — ช่องอัปโหลดไฟล์สลิป (UPLOAD FILE) ผูกกับยอด Top-up ของ Cash Card ที่เลือก */}
      <h2 className="font-semibold">Upload Slip</h2>
      <div className="rounded-xl border bg-white p-3">
        {/* โหมดเจ้าหน้าที่: ผูกลูกค้า (userId ใน DB) — สลิปจะถูกบันทึกเข้ากระเป๋าของลูกค้าคนนี้หลังกดอนุมัติ */}
        {isMemberMode ? (
          <p className="mb-3 text-xs text-muted-foreground">
            สลิปนี้จะถูกบันทึกเข้ากระเป๋าของคุณ (สมาชิกที่ล็อกอินอยู่)
          </p>
        ) : (
          <div className="mb-3 space-y-1">
            <label htmlFor="slip-customer" className="text-xs font-medium text-muted-foreground">
              ผูกลูกค้า (LINE User ID)
            </label>
            <select
              id="slip-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-9 w-full rounded-lg border bg-white px-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">— เลือกลูกค้า —</option>
              {(members ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {(member.lineDisplayName || member.name || 'LINE member') +
                    (member.lineUserId ? ` · ${member.lineUserId}` : '')}
                </option>
              ))}
            </select>
            {!(members ?? []).length && (
              <p className="text-[11px] text-muted-foreground">ยังไม่มีลูกค้า LINE — ให้ลูกค้าล็อกอิน LINE ก่อน</p>
            )}
          </div>
        )}

        {slipConfirmed !== null ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              ยืนยันแล้ว {formatBaht(slipConfirmed)}
            </span>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setSlipConfirmed(null)}>
              แนบสลิปใหม่
            </Button>
          </div>
        ) : slipDataUrl ? (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <img src={slipDataUrl} alt="สลิปที่เลือก" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{slipName}</div>
                <div className="text-xs text-emerald-700">พร้อมอัปโหลด</div>
              </div>
              <button
                type="button"
                onClick={removeSlip}
                className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                aria-label="ลบไฟล์"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ScanText className="h-3.5 w-3.5" /> อ่านจากสลิป:
                </span>
                {ocrLoading ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังอ่าน…
                  </span>
                ) : ocrAmount !== null ? (
                  <span className="font-semibold text-emerald-700">{formatBaht(ocrAmount)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              {ocrError && <p className="text-xs text-red-500">{ocrError}</p>}

              <Slip2GoStatus status={verifyStatus} prefix="ตรวจสลิป" />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  ยอด Top-up: <span className="font-semibold text-emerald-700">{formatBaht(selected.get)}</span>
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={cancelSlip}>
                    ยกเลิก
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void confirmSlip()}
                    disabled={slipSaving}
                  >
                    {slipSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    ยืนยัน
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => slipInputRef.current?.click()}
            disabled={!effectiveCustomerId}
            className={
              'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 p-5 transition-colors ' +
              (effectiveCustomerId ? 'cursor-pointer hover:bg-emerald-50/50' : 'cursor-not-allowed opacity-60')
            }
          >
            <UploadCloud className="h-7 w-7 text-emerald-500" />
            <span className="text-sm font-semibold tracking-wide text-emerald-700">UPLOAD FILE</span>
            <span className="text-[11px] text-muted-foreground">
              {effectiveCustomerId ? 'jpg / png — ไม่เกิน 300kB' : 'เลือกลูกค้าก่อนอัปโหลดสลิป'}
            </span>
          </button>
        )}

        <input
          ref={slipInputRef}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => handleSlipFile(e.target.files?.[0] ?? null)}
        />

        {slipError && <p className="mt-2 text-xs text-red-500">{slipError}</p>}
      </div>
    </div>
  )
}
