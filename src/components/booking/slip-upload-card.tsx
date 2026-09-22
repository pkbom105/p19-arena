'use client'

import { apiUrl } from '@/lib/api'
import { useRef, useState } from 'react'
import { UploadCloud, X, Loader2, CheckCircle2, Receipt } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const MAX_SLIP_SIZE = 300 * 1024 // 300kB — ตรงกับ step-confirm และ /api/my-bookings

/**
 * การ์ด "ส่งสลิปการชำระเงิน" (หน้า /check) — แสดงใต้ปุ่มสแกน QR
 * ใช้สำหรับลูกค้าที่จองแล้วแต่ยังไม่ได้แนบสลิป (หรือต้องการส่งสลิปใหม่)
 * ส่งสลิปแล้วสถานะการจองเปลี่ยนเป็น "รอชำระ" ให้แอดมินตรวจสอบที่ Dashboard → Slip Upload
 */
export function SlipUploadCard({
  defaultPhone = '',
  defaultCode = '',
  onUploaded,
}: {
  /** เบอร์โทรที่พิมพ์ไว้ในช่องค้นหา — เติมให้อัตโนมัติ */
  defaultPhone?: string
  /** รหัสตั๋วที่พิมพ์/สแกนไว้ — เติมให้อัตโนมัติ */
  defaultCode?: string
  /** เรียกหลังส่งสลิปสำเร็จ (ให้หน้าหลักค้นหาการจองใหม่เพื่ออัปเดตสถานะ) */
  onUploaded?: () => void
}) {
  const [phone, setPhone] = useState(defaultPhone)
  const [code, setCode] = useState(defaultCode)
  const [slip, setSlip] = useState<{ dataUrl: string; name: string; size: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // เติมค่าจากช่องค้นหาด้านบนเสมอ (ผู้ใช้ไม่ต้องพิมพ์ซ้ำ)
  // ปรับ state ระหว่าง render ตามแนวทางของ React (you-might-not-need-an-effect — adjusting state when a prop changes)
  const [prevPhone, setPrevPhone] = useState(defaultPhone)
  const [prevCode, setPrevCode] = useState(defaultCode)
  if (prevPhone !== defaultPhone) {
    setPrevPhone(defaultPhone)
    setPhone(defaultPhone)
  }
  if (prevCode !== defaultCode) {
    setPrevCode(defaultCode)
    setCode(defaultCode)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setSlipError(null)
    setDone(null)
    if (!file) return

    const isJpg = file.type === 'image/jpeg'
    const isPng = file.type === 'image/png'
    if (!isJpg && !isPng) {
      setSlipError('รองรับเฉพาะไฟล์ .jpg หรือ .png เท่านั้น')
      e.target.value = ''
      return
    }
    if (file.size > MAX_SLIP_SIZE) {
      setSlipError(`ไฟล์ใหญ่เกินไป (สูงสุด 300kB) — ไฟล์นี้ ${Math.ceil(file.size / 1024)}kB`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSlip({ dataUrl: String(reader.result), name: file.name, size: file.size })
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = () => {
    setSlip(null)
    setSlipError(null)
    setDone(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    setError(null)
    setDone(null)
    const effCode = code.trim().toUpperCase()
    const effPhone = phone.trim()
    if (!effCode && !effPhone) {
      setError('กรุณากรอกรหัสตั๋ว หรือเบอร์โทรศัพท์ที่ใช้จอง')
      return
    }
    if (!slip) {
      setError('กรุณาแนบไฟล์สลิปการชำระเงิน')
      return
    }

    setSending(true)
    try {
      const res = await fetch(apiUrl('/api/my-bookings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ถ้ามีรหัสตั๋ว ใช้รหัส (แม่นที่สุด) ไม่งั้นใช้เบอร์โทร (การจองล่าสุดของเบอร์นั้น)
          ticketCode: effCode || undefined,
          playerPhone: effCode ? undefined : effPhone,
          slipName: slip.name,
          slipDataUrl: slip.dataUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'ส่งสลิปไม่สำเร็จ')

      toast.success('ส่งสลิปแล้ว — รอการตรวจสอบจากเจ้าหน้าที่')
      setDone(`ส่งสลิปสำหรับตั๋ว #${data.ticketCode || ''} (${data.court?.name || ''} ${data.timeSlot?.startTime || ''}-${data.timeSlot?.endTime || ''}) เรียบร้อยแล้ว`)
      setSlip(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploaded?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งสลิปไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="border-emerald-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-medium text-sm leading-snug">ส่งสลิปการชำระเงิน</h3>
            <p className="text-[11px] text-muted-foreground">
              สำหรับการจองที่ชำระแล้วแต่ยังไม่ได้แนบสลิป — แนบสลิปเพื่อให้เจ้าหน้าที่ตรวจสอบ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">รหัสตั๋ว 8 หลัก</Label>
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setDone(null) }}
              maxLength={8}
              placeholder="เช่น CZSD6723"
              autoCapitalize="characters"
              className="h-9 text-sm font-mono uppercase tracking-[0.2em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">หรือ เบอร์โทรศัพท์</Label>
            <Input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setDone(null) }}
              type="tel"
              inputMode="tel"
              placeholder="0XX-XXX-XXXX"
              className="h-9 text-sm"
            />
          </div>
        </div>

        {slip ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <img src={slip.dataUrl} alt="สลิป" className="w-14 h-14 object-cover rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{slip.name}</div>
              <div className="text-xs text-emerald-700">พร้อมส่ง ({Math.ceil(slip.size / 1024)}kB)</div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 shrink-0"
              aria-label="ลบสลิป"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-emerald-300 rounded-xl p-5 flex flex-col items-center gap-2 hover:bg-emerald-50/50 transition-colors cursor-pointer"
          >
            <UploadCloud className="h-7 w-7 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">แนบไฟล์สลิป</span>
            <span className="text-[11px] text-muted-foreground">jpg / png — ไม่เกิน 300kB</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFile}
        />

        <Button
          onClick={handleSubmit}
          disabled={sending || !slip}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
          ส่งสลิป
        </Button>

        {slipError && <p className="text-xs text-red-500">{slipError}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {done && (
          <p className="flex items-start gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{done}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}