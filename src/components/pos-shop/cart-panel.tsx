'use client'

import { CalendarDays, CreditCard, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTHB } from './catalog'
import type { CartLine } from './types'

export type DiscountType = 'amount' | 'percent'

const toggleCls = (on: boolean) =>
  'h-8 w-9 px-0 ' +
  (on ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white' : '')

/**
 * การ์ดตะกร้าสินค้า + ส่วนลด + ยอดสุทธิ (อยู่ในคอลัมน์ขวาที่ sticky — การ์ด "บิลล่าสุด" แยกอยู่ถัดลงมา)
 * ความสูงขั้นต่ำ 500px (min-h-[500px]) และ "ขยายตามสินค้า" เมื่อของในตะกร้าล้นกล่อง — ไม่ตัดเป็น scroll ในลิสต์
 * บล็อกสรุปรายการ (รวมสินค้า/ส่วนลด/ยอดสุทธิ/ปุ่มชำระเงิน) ยึดติดขอบล่างการ์ดเสมอ (mt-auto ใน flex-col)
 */
export function CartPanel({ lines, subtotal, discount, discountType, discountValue, onDiscountType, onDiscountValue, total, onInc, onDec, onRemove, onClear, onCheckout }: {
  lines: CartLine[]
  subtotal: number
  /** ส่วนลดที่คิดเป็นบาทแล้ว */
  discount: number
  discountType: DiscountType
  discountValue: number
  onDiscountType: (t: DiscountType) => void
  onDiscountValue: (v: number) => void
  total: number
  onInc: (id: string) => void
  onDec: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  onCheckout: () => void
}) {
  const itemCount = lines.reduce((s, l) => s + l.qty, 0)

  return (
    <section className="flex min-h-[450px] flex-col gap-3 rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="h-4 w-4 text-emerald-600" /> ตะกร้า
          <Badge variant="secondary" className="text-xs">{itemCount} ชิ้น</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClear} disabled={lines.length === 0}>
          ล้างตะกร้า
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="flex-1 py-8 text-center text-sm text-muted-foreground">ยังไม่มีสินค้าในตะกร้า — กดการ์ดสินค้าเพื่อเพิ่ม</p>
      ) : (
        <div data-slot="cart-lines" className="flex-1 space-y-2">
          {lines.map(({ product: p, qty, note }) => (
            <div key={`${p.id}-${note ?? ''}`} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
              <span className="shrink-0 text-xl leading-none">{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.category === 'coach'
                    ? <>{formatTHB(p.price)}/ชม. × {qty} ชม. = <span className="font-semibold text-emerald-700">{formatTHB(p.price * qty)}</span></>
                    : <>{formatTHB(p.price)} × {qty} = <span className="font-semibold text-emerald-700">{formatTHB(p.price * qty)}</span></>}
                </div>
                {note && (
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    <CalendarDays className="h-3 w-3" /> {note}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => onDec(p.id)} aria-label={`ลดจำนวน ${p.name}`}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{qty}</span>
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => onInc(p.id)} aria-label={`เพิ่มจำนวน ${p.name}`}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(p.id)} aria-label={`ลบ ${p.name}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div data-slot="cart-summary" className="mt-auto space-y-2 border-t pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">รวมสินค้า ({itemCount} ชิ้น)</span>
          <span className="font-medium">{formatTHB(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">ส่วนลด</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className={toggleCls(discountType === 'amount')} onClick={() => onDiscountType('amount')} aria-label="ส่วนลดเป็นบาท">
              ฿
            </Button>
            <Button variant="outline" size="sm" className={toggleCls(discountType === 'percent')} onClick={() => onDiscountType('percent')} aria-label="ส่วนลดเป็นเปอร์เซ็นต์">
              %
            </Button>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={discountValue || ''}
              onChange={(e) => onDiscountValue(Math.max(0, Number(e.target.value) || 0))}
              className="h-8 w-20 text-right"
              aria-label="จำนวนส่วนลด"
            />
          </div>
        </div>

        {discount > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>หักส่วนลด</span>
            <span>-{formatTHB(discount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-base font-bold">
          <span>ยอดสุทธิ</span>
          <span className="text-emerald-700">{formatTHB(total)}</span>
        </div>

        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={lines.length === 0} onClick={onCheckout}>
          <CreditCard className="mr-1 h-4 w-4" /> ชำระเงิน · {formatTHB(total)}
        </Button>
      </div>
    </section>
  )
}
