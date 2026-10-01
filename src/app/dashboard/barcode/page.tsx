'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, Barcode as BarcodeIcon, Loader2, Printer, RefreshCw } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PosHeader } from '@/components/pos/pos-header'
import { PosMobileNav, PosSidebar } from '@/components/pos/pos-sidebar'
import { LabelSheet, SingleLabel, type LabelItem } from '@/components/barcode/label-sheet'
import { LABEL_SPEC, LABEL_SPEC_TEXT, ROW_WIDTH_MM, SIDE_MARGIN_MM } from '@/components/barcode/label-spec'
import { normalizeEan13, generateEan13 } from '@/lib/ean13'
import { toast } from 'sonner'

interface ShopProductLite {
  id: string
  name: string
  price: number
  barcode?: string | null
}

type Source = 'product' | 'manual'
type QrMode = 'code' | 'full'
type CodeType = 'ean' | 'qr' | 'both'

/** ตัวเลือก "รูปแบบที่พิมพ์" — ใช้ปุ่ม (ตรวจด้วย automation ได้ ต่างจาก dropdown) */
const MODE_OPTIONS: { value: CodeType; label: string }[] = [
  { value: 'both', label: 'ทั้งคู่ (1D + 2D)' },
  { value: 'ean', label: '1D — EAN-13' },
  { value: 'qr', label: '2D — QR' },
]

/**
 * ขนาดคงที่ของการ์ด "ตัวอย่างเดี่ยว (1 ดวง)"
 *  - SINGLE_CARD_H: ความสูงการ์ดทั้งใบ 400px (ไม่ผูกกับความสูงการ์ดฟอร์มซ้ายแล้ว)
 *  - SINGLE_PREVIEW_H: ความสูงกล่องพรีวิวใน (ตัวครอบฉลากที่สเกลแล้ว) — ฉลากจัดกลางด้วย flex
 */
const SINGLE_CARD_H = 300
const SINGLE_PREVIEW_H = 180

/**
 * หน้าบาร์โค้ด (/dashboard/barcode) — เมนูอยู่ต่อจาก shop-report
 *  - EAN-13: encoder ในโปรเจกต์ (src/lib/ean13.ts) · QR 2D: ไลบรารี `qrcode` ที่มีอยู่แล้ว
 *  - ฉลากตามสเปกกระดาษ: 3.4 × 2.0 cm · 3 ดวง/แถว · gap 2 mm · กระดาษกว้าง 10.9 cm · core 1.5″
 */
export default function BarcodePage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [products, setProducts] = useState<ShopProductLite[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<Source>('manual')
  const [productId, setProductId] = useState('')
  const [manualCode, setManualCode] = useState('8851234567898')
  const [name, setName] = useState('เสื้อยืด P19 Dry-Fit (แขนสั้น)')
  const [price, setPrice] = useState<number>(390)
  const [copies, setCopies] = useState(3)
  const [qrMode, setQrMode] = useState<QrMode>('code')
  const [codeType, setCodeType] = useState<CodeType>('both')
  /** prefix 3 หลักสำหรับสุ่มบาร์โค้ดใหม่ (ค่าเริ่มต้น 885 = ไทย) */
  const [prefix, setPrefix] = useState('885')
  /** โหมด "เลือกจากสินค้า": ค่าบาร์โค้ดที่จะแสดงบนฉลาก/บันทึกกลับเข้าสินค้า (ยังไม่ได้ save จนกว่าจะกดปุ่ม) */
  const [draftBarcode, setDraftBarcode] = useState('')
  const [savingBarcode, setSavingBarcode] = useState(false)

  /** การ์ดฟอร์ม "ข้อมูลบนฉลาก" + การ์ด "ตัวอย่างเดี่ยว" — ใช้เทียบ/ปรับความสูงให้เท่ากัน */
  const singleCardRef = useRef<HTMLDivElement | null>(null)
  /**
   * ค่าที่วัดจากการ์ดจริง (เก็บใน state เพื่อสั่ง re-render) — ตั้งค่าเฉพาะเมื่อตัวเลขเปลี่ยน กัน loop จาก ResizeObserver
   *  - singleContentW: ความกว้างเนื้อใน (หัก px-6 แล้ว) ของการ์ดตัวอย่างเดี่ยว → ใช้คิดพรีวิว 50%
   *  - labelNatW: ความกว้างฉลากจริงก่อนสเกล (34 mm) → ใช้หาอัตราสเกล
   */
  const [singleContentW, setSingleContentW] = useState(0)
  const [labelNatW, setLabelNatW] = useState(0)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/shop-products?all=1'))
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setProducts(data)
      }
    } catch (err) {
      console.error('Failed to fetch shop products', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  const selected = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId])
  /** ดึงค่าบาร์โค้ดปัจจุบันของสินค้ามาเป็น draft (รวมหลัง save/refresh) */
  useEffect(() => { setDraftBarcode(selected?.barcode || '') }, [selected])

  /**
   * สเกลพรีวิว "ตัวอย่างเดี่ยว" เป็น 50% ของความกว้างเนื้อในการ์ด และเก็บขนาดฉลากจริงไว้คิดอัตราสเกล
   *  (ความสูงการ์ดคงที่ SINGLE_CARD_H แล้ว ไม่ต้อง sync ตามการ์ดฟอร์มซ้าย)
   *  - วัดจากการ์ดจริงด้วย ResizeObserver (จอ/คอลัมน์เปลี่ยนแล้วยังตรง)
   *  - transform: scale ไม่กระทบ layout ของฉลาก (offsetWidth ยังเป็นขนาดจริง 34 mm) จึงไม่เกิด loop
   */
  useEffect(() => {
    const single = singleCardRef.current
    if (!single) return
    const sync = () => {
      const content = single.querySelector('[data-slot="card-content"]') as HTMLElement | null
      const nextW = content ? Math.round(content.clientWidth) : 0
      setSingleContentW((prev) => (prev === nextW ? prev : nextW))
      const label = single.querySelector('[data-slot="bc-label-single"]') as HTMLElement | null
      const nextLabelW = label ? label.offsetWidth : 0
      setLabelNatW((prev) => (prev === nextLabelW ? prev : nextLabelW))
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(single)
    return () => ro.disconnect()
  }, [loading])
  const rawCode = source === 'product' ? draftBarcode : manualCode
  const norm = useMemo(() => normalizeEan13(rawCode), [rawCode])
  const labelName = source === 'product' ? (selected?.name || '') : name
  const labelPrice = source === 'product' ? (selected?.price ?? 0) : price

  const items: LabelItem[] = useMemo(() => {
    if (!norm.ok) return []
    return Array.from({ length: copies }, () => ({
      code: norm.code,
      name: labelName,
      price: labelPrice,
      qrText: qrMode === 'code' ? norm.code : `${norm.code}|${labelName}|${labelPrice}`,
      codeType,
    }))
  }, [norm, copies, labelName, labelPrice, qrMode, codeType])

  /** บาร์โค้ดทั้งหมดที่มีอยู่ในระบบ (ใช้กันไม่ให้สุ่มซ้ำ) */
  const existingBarcodes = useMemo(
    () => products.map((p) => p.barcode).filter((c): c is string => !!c),
    [products],
  )

  /** สุ่ม EAN-13 ใหม่จาก prefix ที่กำหนด (ยังไม่บันทึก จนกว่าจะกด "บันทึกใส่สินค้านี้") */
  const handleGenerateBarcode = () => {
    setDraftBarcode(generateEan13(existingBarcodes, prefix))
  }

  /** บันทึกบาร์โค้ดในหน้าจอ (draft) ลงสินค้าที่เลือก — ถ้ามีค่าเดิมจะยืนยันก่อนแทนที่ */
  const handleSaveBarcodeToProduct = async () => {
    if (!selected) return
    if (!norm.ok) {
      toast.error(norm.error || 'บาร์โค้ดยังไม่ถูกต้อง')
      return
    }
    const code = norm.code
    if (selected.barcode && selected.barcode !== code) {
      const ok = window.confirm(
        `สินค้า "${selected.name}" มีบาร์โค้ดเดิม ${selected.barcode}\nยืนยันแทนที่ด้วย ${code} ?`,
      )
      if (!ok) return
    }
    setSavingBarcode(true)
    try {
      const res = await fetch(apiUrl('/api/shop-products'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, barcode: code }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`บันทึก ${code} → ${selected.name}`)
      setDraftBarcode(code)
      await loadProducts()
    } catch (err) {
      console.error('Failed to save barcode', err)
      toast.error('บันทึกบาร์โค้ดไม่สำเร็จ')
    } finally {
      setSavingBarcode(false)
    }
  }

  /** ขนาดพรีวิวฉลากเดี่ยว: กว้าง 50% ของเนื้อในการ์ด · สูงคงที่ 500px (ฉลากจัดกลางกล่อง) */
  const singlePreview = useMemo(() => {
    if (!singleContentW || !labelNatW) return { w: 0, h: SINGLE_PREVIEW_H, scale: 1 }
    const w = Math.round(singleContentW * 0.6)
    return { w, h: SINGLE_PREVIEW_H, scale: w / labelNatW }
  }, [singleContentW, labelNatW])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <PosHeader date={todayStr} refreshing={loading} title="barcode" onRefresh={loadProducts} />
      <PosMobileNav active="barcode" />

      <div className="flex flex-1">
        <PosSidebar active="barcode" />

        <main className="grid min-w-0 gap-4 px-4 py-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:pl-4">
          {/* ── คอลัมน์ซ้าย (70%): สร้างบาร์โค้ด ── */}
          <div data-slot="gen-panel" className="min-w-0 space-y-4">
          {/* สเปกกระดาษฉลากที่ใช้ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarcodeIcon className="h-4 w-4 text-emerald-600" /> barcode — EAN-13 + QR 2D
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm text-muted-foreground">{LABEL_SPEC_TEXT}</p>
              <p className="text-xs text-muted-foreground">
                ความกว้างแถว = {LABEL_SPEC.perRow} × {LABEL_SPEC.labelWidthMm} mm + ({LABEL_SPEC.perRow} − 1) × {LABEL_SPEC.gapMm} mm ={' '}
                <b>{ROW_WIDTH_MM} mm</b> · margin ข้างละ <b>{SIDE_MARGIN_MM} mm</b>
              </p>
            </CardContent>
          </Card>
          {/* ข้อมูลบนฉลาก */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ข้อมูลบนฉลาก</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">แหล่งข้อมูล</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                    <SelectTrigger className="h-8 text-sm" aria-label="แหล่งข้อมูล"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">กรอกเอง</SelectItem>
                      <SelectItem value="product">เลือกจากสินค้าในร้าน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {source === 'product' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">สินค้า</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger className="h-8 text-sm" aria-label="สินค้า"><SelectValue placeholder="เลือกสินค้า…" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.barcode ? ` · ${p.barcode}` : ' · (ไม่มีบาร์โค้ด)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor="bc-code">รหัส EAN-13 (12 หรือ 13 หลัก)</Label>
                      <Input id="bc-code" aria-label="รหัสบาร์โค้ด" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="8851234567898" className="h-8 text-sm tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor="bc-name">ชื่อสินค้า (บนฉลาก)</Label>
                      <Input id="bc-name" aria-label="ชื่อสินค้า" value={name} onChange={(e) => setName(e.target.value)} placeholder="เสื้อยืด P19 Dry-Fit" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor="bc-price">ราคา (บาท)</Label>
                      <Input id="bc-price" aria-label="ราคา" type="number" min={0} value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)} className="h-8 text-sm tabular-nums" />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">จำนวนดวงที่พิมพ์</Label>
                  <Select value={String(copies)} onValueChange={(v) => setCopies(Number(v))}>
                    <SelectTrigger className="h-8 text-sm" aria-label="จำนวนดวง"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3, 6, 9, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} ดวง ({n / LABEL_SPEC.perRow} แถว)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">รูปแบบที่พิมพ์</Label>
                  <div className="flex flex-wrap gap-2">
                    {MODE_OPTIONS.map(({ value, label }) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        data-slot="mode-btn"
                        data-mode={value}
                        variant={codeType === value ? 'default' : 'outline'}
                        className={'h-8 text-xs ' + (codeType === value ? 'bg-emerald-600 text-white hover:bg-emerald-700' : '')}
                        onClick={() => setCodeType(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ข้อมูลใน QR</Label>
                  <Select value={qrMode} onValueChange={(v) => setQrMode(v as QrMode)}>
                    <SelectTrigger className="h-8 text-sm" aria-label="ข้อมูลใน QR"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="code">รหัสบาร์โค้ด</SelectItem>
                      <SelectItem value="full">รหัส + ชื่อ + ราคา</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── โหมด "เลือกจากสินค้า": สุ่มบาร์โค้ดใหม่ + บันทึกกลับเข้าสินค้า ── */}
              {source === 'product' && (
                <div data-slot="barcode-actions" className="space-y-3 rounded-lg border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor="bc-prefix">prefix (3 หลัก)</Label>
                      <Input
                        id="bc-prefix"
                        data-slot="prefix-input"
                        aria-label="prefix บาร์โค้ด"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        placeholder="885"
                        className="h-8 w-24 text-sm tabular-nums"
                      />
                    </div>
                    <Button type="button" size="sm" variant="outline" data-slot="gen-barcode-btn" className="h-8" onClick={handleGenerateBarcode} disabled={!selected}>
                      <BarcodeIcon className="h-4 w-4" />
                      สุ่มบาร์โค้ดใหม่
                    </Button>
                    <Button type="button" size="sm" data-slot="save-barcode-btn" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSaveBarcodeToProduct} disabled={!selected || savingBarcode || !norm.ok}>
                      {savingBarcode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                      {savingBarcode ? 'กำลังบันทึก…' : 'บันทึกใส่สินค้านี้'}
                    </Button>
                  </div>
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">บาร์โค้ดปัจจุบันในระบบ:</dt>
                      <dd data-slot="current-barcode" className="tabular-nums">{selected?.barcode || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">ค่าที่จะใช้แสดง/บันทึก:</dt>
                      <dd data-slot="draft-barcode" className="font-medium tabular-nums">{draftBarcode || '—'}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    กด “สุ่มบาร์โค้ดใหม่” เพื่อสร้างเลข EAN-13 (prefix + เลขสุ่ม + check digit ไม่ซ้ำกับที่มีอยู่) แล้วกด “บันทึกใส่สินค้านี้” เพื่อบันทึกลงสินค้าที่เลือก
                    {selected?.barcode ? ' — จะมีกล่องยืนยันก่อนแทนที่บาร์โค้ดเดิม' : ''}
                  </p>
                </div>
              )}

              {norm.error && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {norm.error}
                    {source === 'product' && !selected?.barcode ? ' — สินค้านี้ยังไม่มีบาร์โค้ด: กด “สุ่มบาร์โค้ดใหม่” ด้านบน หรือเปลี่ยนเป็นโหมด “กรอกเอง”' : ''}
                  </span>
                </div>
              )}

              {norm.ok && (
                <p className="text-xs text-muted-foreground">
                  EAN-13: <b className="tabular-nums">{norm.code}</b>
                  {rawCode.replace(/\D/g, '').length === 12 ? ' (เติม check digit ให้แล้ว)' : ''}
                </p>
              )}
            </CardContent>
          </Card>
          </div>

          {/* ── คอลัมน์ขวา (30%): preview ── */}
          <div data-slot="preview-panel" className="min-w-0 space-y-4 lg:sticky lg:top-16 lg:self-start">
            {/* preview เดี่ยว 1 ดวง */}
            <Card ref={singleCardRef} className="flex flex-col" style={{ minHeight: SINGLE_CARD_H }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ตัวอย่างเดี่ยว (1 ดวง)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 items-center justify-center">
                {norm.ok ? (
                  <div data-slot="single-preview-wrap" className="flex w-full items-center justify-center">
                    <div
                      data-slot="single-preview-scaler"
                      style={{ width: singlePreview.w || undefined, height: singlePreview.h || undefined }}
                      className="flex items-center justify-center"
                    >
                      <div className="w-fit" style={{ transform: `scale(${singlePreview.scale})`, transformOrigin: 'center center' }}>
                        <SingleLabel item={items[0]} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">กรอกรหัสบาร์โค้ดเพื่อดูตัวอย่าง</p>
                )}
              </CardContent>
            </Card>

            {/* preview แผ่นก่อนพิมพ์ */}
            <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>ตัวอย่างก่อนพิมพ์ ({LABEL_SPEC.perRow} ดวง/แถว · ขนาดจริง {LABEL_SPEC.labelWidthMm / 10} × {LABEL_SPEC.labelHeightMm / 10} cm)</span>
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={loadProducts} disabled={loading}>
                    <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> รีเฟรชสินค้า
                  </Button>
                  <Button size="sm" className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={() => window.print()} disabled={!norm.ok}>
                    <Printer className="mr-1 h-3.5 w-3.5" /> พิมพ์ฉลาก
                  </Button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {norm.ok ? (
                <LabelSheet items={items} />
              ) : (
                <p className="text-sm text-muted-foreground">กรอกรหัสบาร์โค้ด (12 หรือ 13 หลัก) เพื่อดูตัวอย่างฉลาก</p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                การพิมพ์: กด &quot;พิมพ์ฉลาก&quot; แล้วเลือกกระดาษ/ม้วนในไดรเวอร์เครื่องพิมพ์ (กว้าง {LABEL_SPEC.paperWidthMm / 10} cm) ·
                หน้าตัวอย่างจะพิมพ์เฉพาะแผ่นฉลาก · EAN-13 = encoder ในโปรเจกต์ · QR = ไลบรารี qrcode ที่มีอยู่แล้ว
              </p>
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

