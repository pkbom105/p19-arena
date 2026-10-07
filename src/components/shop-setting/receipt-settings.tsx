'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Receipt, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReceiptA5 } from '@/components/pos-shop/receipt-a5'
import type { ShopBill } from '@/components/pos-shop/types'
import {
  DEFAULT_RECEIPT_BRANDING,
  RECEIPT_BRANDING_KEYS,
  receiptBrandingFromSettings,
  type ReceiptBranding,
} from '@/lib/receipt-branding'

/** บิลตัวอย่างสำหรับตัวอย่างใบเสร็จ — วันที่คงที่ (กัน hydration ไม่ตรงกัน) */
const SAMPLE_BILL: ShopBill = {
  code: 'S-2601001',
  no: 1,
  items: [
    { name: 'ค่าสนาม 1 ชั่วโมง', qty: 1, price: 300 },
    { name: 'เช่าแร็กเก็ต', qty: 2, price: 50, note: 'คืนก่อน 22:00 น.' },
    { name: 'น้ำดื่ม', qty: 1, price: 15 },
  ],
  subtotal: 415,
  discount: 0,
  total: 415,
  method: 'cash',
  received: 500,
  change: 85,
  at: '2026-10-05T14:30:00.000Z',
}

/**
 * ตั้งค่าใบเสร็จ — 2 คอลัมน์ 60/40
 * ซ้าย (60%): ฟอร์มหัวใบเสร็จ (โลโก้/ชื่อร้าน/หัวข้อ/คำโปรย/เลขผู้เสียภาษี) บันทึกลง Settings
 * ขวา (40%): ตัวอย่างใบเสร็จ A5 ที่สะท้อนค่าที่กรอกทันที (ยังไม่ต้องกดบันทึก)
 */
export function ReceiptSettings() {
  const [form, setForm] = useState<ReceiptBranding>(DEFAULT_RECEIPT_BRANDING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  /** โหลดค่าที่บันทึกไว้จาก /api/settings (คีย์ receipt_*) */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/settings'), { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const kv = await res.json()
      setForm(receiptBrandingFromSettings(kv))
    } catch (err) {
      console.error('Failed to fetch receipt settings', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const set = (patch: Partial<ReceiptBranding>) => setForm((prev) => ({ ...prev, ...patch }))

  /** บันทึกทุกคีย์ที่เกี่ยวกับหัวใบเสร็จ (PUT /api/settings ทีละ key) */
  const handleSave = async () => {
    setSaving(true)
    try {
      const entries: [string, string][] = [
        [RECEIPT_BRANDING_KEYS.logo, form.logo.trim()],
        [RECEIPT_BRANDING_KEYS.shopName, form.shopName.trim()],
        [RECEIPT_BRANDING_KEYS.title, form.title.trim()],
        [RECEIPT_BRANDING_KEYS.subheader, form.subheader.trim()],
        [RECEIPT_BRANDING_KEYS.taxId, form.taxId.trim()],
      ]
      await Promise.all(
        entries.map(([key, value]) =>
          fetch(apiUrl('/api/settings'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          })
        )
      )
      toast.success('บันทึกการตั้งค่าใบเสร็จแล้ว')
    } catch (err) {
      console.error('Failed to save receipt settings', err)
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* 60% — ตั้งค่าใบเสร็จ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-emerald-600" /> ตั้งค่าใบเสร็จ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="receipt-logo">โลโก้ (URL รูปภาพ)</Label>
                <Input
                  id="receipt-logo"
                  aria-label="โลโก้ใบเสร็จ"
                  value={form.logo}
                  onChange={(e) => set({ logo: e.target.value })}
                  placeholder="https://…/logo.png (เว้นว่าง = ใช้กล่อง P19)"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="receipt-shop-name">ชื่อร้าน</Label>
                <Input
                  id="receipt-shop-name"
                  aria-label="ชื่อร้านบนใบเสร็จ"
                  value={form.shopName}
                  onChange={(e) => set({ shopName: e.target.value })}
                  placeholder="P19 Pickleball Arena"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="receipt-title">หัวข้อ</Label>
                <Input
                  id="receipt-title"
                  aria-label="หัวข้อใบเสร็จ"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="ใบเสร็จรับเงิน / RECEIPT"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="receipt-subheader">คำโปรย (sub header)</Label>
                <Input
                  id="receipt-subheader"
                  aria-label="คำโปรยใต้หัวข้อ"
                  value={form.subheader}
                  onChange={(e) => set({ subheader: e.target.value })}
                  placeholder="เช่น สาขา / ที่อยู่"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="receipt-tax-id">เลขประจำตัวผู้เสียภาษี</Label>
                <Input
                  id="receipt-tax-id"
                  aria-label="เลขประจำตัวผู้เสียภาษี"
                  value={form.taxId}
                  onChange={(e) => set({ taxId: e.target.value })}
                  placeholder="0-0000-00000-00-0"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} บันทึก
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={load} disabled={saving || loading}>
                  <RotateCcw className="mr-1 h-3 w-3" /> คืนค่าเดิม
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ค่านี้ใช้กับใบเสร็จที่พิมพ์จริงจากหน้า pos-shop และ shop-report
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 40% — ตัวอย่างใบเสร็จ (sticky บนจอใหญ่) */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-emerald-600" /> ตัวอย่างใบเสร็จ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-slate-100 p-2">
              <ReceiptA5 bill={SAMPLE_BILL} branding={form} preview />
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">ตัวอย่างจะเปลี่ยนตามค่าที่กรอก (ยังไม่ต้องกดบันทึก)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
