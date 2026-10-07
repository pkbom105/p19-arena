'use client'

import { apiUrl } from '@/lib/api'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Loader2, CalendarX2, Phone, Ticket } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { BookingTicket, type TicketBooking } from '@/components/booking/booking-ticket'
import { buildTicketViews, mergeTicketView } from '@/lib/ticket-group'
import { TicketQrScanner } from '@/components/booking/ticket-qr-scanner'
import { SlipUploadCard } from '@/components/booking/slip-upload-card'
import { Button } from '@/components/ui/button'

export default function CheckBookingPage() {
  const [phone, setPhone] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchedByCode, setSearchedByCode] = useState(false)
  const [bookings, setBookings] = useState<TicketBooking[]>([])
  /** id ของแถวที่ค้นเจอจริง — ค้นด้วยรหัสจะเจอแถวเดียว แต่แสดงเป็น "ตั๋วใบรวม" ของกลุ่มแถวนั้น */
  const [foundIds, setFoundIds] = useState<string[]>([])

  // รหัสตั๋ว: บังคับเป็นตัวพิมพ์ใหญ่เสมอ (พิมพ์เล็ก → เปลี่ยนเป็นพิมพ์ใหญ่อัตโนมัติ)
  const code = codeInput.trim().toUpperCase()

  /**
   * ตั๋วที่จะแสดง = กลุ่ม "สนามเดิม + วันเดิม + ผู้จองเดิม + เวลาติดกัน" (ใบเดียวต่อกลุ่ม)
   * — ค้นด้วยเบอร์: แสดงทุกใบของเบอร์นั้น / ค้นด้วยรหัส: แสดงเฉพาะใบที่มีรหัสนั้น แต่เป็นใบรวมทั้งใบ
   */
  const found = new Set(foundIds)
  const views = buildTicketViews(bookings).filter((v) => found.size === 0 || v.rows.some((row) => found.has(row.id)))

  const handleLookup = async (customCode?: string) => {
    const phoneQ = phone.trim()
    const effCode = (customCode ?? code).trim().toUpperCase()
    if (loading || (!phoneQ && !effCode)) return
    // ถ้ากรอกทั้งสองช่อง ใช้รหัสตั๋ว (แม่นที่สุด เพราะเป็น unique)
    const byCode = effCode.length > 0
    setSearchedByCode(byCode)
    setLoading(true)
    try {
      const qs = byCode
        ? `ticketCode=${encodeURIComponent(effCode)}`
        : `playerPhone=${encodeURIComponent(phoneQ)}`
      const res = await fetch(apiUrl(`/api/my-bookings?${qs}`))
      const data = await res.json()
      const rows: TicketBooking[] = Array.isArray(data) ? data : []
      setFoundIds(rows.map((r) => r.id))
      // ค้นด้วยรหัสตั๋วจะได้แถวเดียว — ดึงแถวอื่นของเบอร์เดียวกันมาด้วย เพื่อแสดง "ตั๋วใบรวม" ให้ครบทั้งใบ
      if (byCode && rows.length === 1 && rows[0]?.playerPhone) {
        const sibRes = await fetch(apiUrl(`/api/my-bookings?playerPhone=${encodeURIComponent(rows[0].playerPhone)}`))
        const sibData = await sibRes.json()
        setBookings(Array.isArray(sibData) ? sibData : rows)
      } else {
        setBookings(rows)
      }
      // พบผลลัพธ์ → เลื่อนไปยังส่วน "พบตั๋ว" (anchor #check-results) หลัง DOM อัปเดต
      if (rows.length > 0) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            document.getElementById('check-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          )
        )
      }
    } catch {
      setBookings([])
      setFoundIds([])
    } finally {
      setSearched(true)
      setLoading(false)
    }
  }

  const handleQrScan = (scannedCode: string) => {
    setCodeInput(scannedCode)
    setSearched(false)
    setBookings([])
    handleLookup(scannedCode)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/50 to-background">
      <SiteHeader />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold">ตรวจสอบการจอง</h2>
          <p className="text-sm text-muted-foreground">ค้นหาด้วยเบอร์โทรศัพท์ หรือรหัสตั๋ว 8 หลัก</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="check-phone" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              เบอร์โทรศัพท์
            </label>
            <input
              id="check-phone"
              type="tel"
              inputMode="tel"
              placeholder="0XX-XXX-XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup() }}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="check-code" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Ticket className="h-3.5 w-3.5" />
              รหัสตั๋ว 8 หลัก
            </label>
            <input
              id="check-code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={8}
              placeholder="เช่น CZSD6723"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup() }}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm font-mono uppercase tracking-[0.25em]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => handleLookup()}
            disabled={loading || (!phone.trim() && !code)}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            ค้นหา
          </Button>
          <TicketQrScanner onScan={handleQrScan} />

          {/* ส่งสลิปการชำระเงิน — อยู่ใต้กล้องสแกน QR */}
          <SlipUploadCard
            defaultPhone={phone}
            defaultCode={code}
            onUploaded={() => { if (bookings.length > 0) handleLookup() }}
          />

          <p className="text-center text-xs text-muted-foreground">
            กรอกอย่างใดอย่างหนึ่ง — ถ้ากรอกทั้งสองช่อง ระบบจะค้นหาด้วยรหัสตั๋ว<br />
            หรือใช้ปุ่มสแกน QR เพื่อถ่ายภาพ QR บนตั๋วแล้วค้นหาให้อัตโนมัติ
          </p>
        </div>

        {searched && !loading && bookings.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
            <CalendarX2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchedByCode ? `ไม่พบตั๋วรหัส ${code}` : 'ไม่พบการจองสำหรับเบอร์โทรนี้'}
            </p>
            <Link href="/" className="inline-block text-sm text-emerald-600 underline hover:text-emerald-700">
              ไปจองสนาม →
            </Link>
          </div>
        )}

        {views.length > 0 && (
          <div id="check-results" className="space-y-2 scroll-mt-50">
            <p className="text-xs text-muted-foreground">
              พบตั๋ว {views.length} ใบ{bookings.length > views.length ? ` (จาก ${bookings.length} รายการ)` : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              {views.map((view) => {
                const lead = view.lead
                return (
                  <div key={lead.id} className="space-y-1.5">
                    {/* ใบเดียวต่อกลุ่มเวลาติดกัน — เวลา/ชั่วโมง/โค้ชเป็นของทั้งใบ, รหัสใช้ของแถวแรก */}
                    {/* แสดงปุ่ม ดู (Eye) + ดาวน์โหลด (Download) — ปุ่มอื่นไม่ขึ้นเพราะไม่ได้ส่ง handler มา */}
                    <BookingTicket
                      booking={mergeTicketView(lead, view)}
                      ticketHref={apiUrl(`/ticket/${lead.ticketCode || lead.id}`)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t bg-white/60">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          © 2025 P19 Pickleball Arena. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
