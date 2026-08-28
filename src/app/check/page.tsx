'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Loader2, CalendarX2, Phone, Ticket } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { BookingTicket, type TicketBooking } from '@/components/booking/booking-ticket'
import { Button } from '@/components/ui/button'

export default function CheckBookingPage() {
  const [phone, setPhone] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchedByCode, setSearchedByCode] = useState(false)
  const [bookings, setBookings] = useState<TicketBooking[]>([])

  // รหัสตั๋ว: บังคับเป็นตัวพิมพ์ใหญ่เสมอ (พิมพ์เล็ก → เปลี่ยนเป็นพิมพ์ใหญ่อัตโนมัติ)
  const code = codeInput.trim().toUpperCase()

  const handleLookup = async () => {
    const phoneQ = phone.trim()
    if (loading || (!phoneQ && !code)) return
    // ถ้ากรอกทั้งสองช่อง ใช้รหัสตั๋ว (แม่นที่สุด เพราะเป็น unique)
    const byCode = code.length > 0
    setSearchedByCode(byCode)
    setLoading(true)
    try {
      const qs = byCode
        ? `ticketCode=${encodeURIComponent(code)}`
        : `playerPhone=${encodeURIComponent(phoneQ)}`
      const res = await fetch(`/api/my-bookings?${qs}`)
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch {
      setBookings([])
    } finally {
      setSearched(true)
      setLoading(false)
    }
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
            onClick={handleLookup}
            disabled={loading || (!phone.trim() && !code)}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            ค้นหา
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            กรอกอย่างใดอย่างหนึ่ง — ถ้ากรอกทั้งสองช่อง ระบบจะค้นหาด้วยรหัสตั๋ว
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

        {bookings.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">พบการจอง {bookings.length} รายการ</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              {bookings.map((b) => (
                <div key={b.id} className="space-y-1.5">
                  <BookingTicket booking={b} hideActions />
                  <Link
                    href={`/ticket/${b.ticketCode || b.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-xs text-emerald-600 underline hover:text-emerald-700 break-all"
                  >
                    เปิดหน้าตั๋วออนไลน์ →
                  </Link>
                </div>
              ))}
            </div>
          </>
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
