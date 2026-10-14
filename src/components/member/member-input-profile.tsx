'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Save, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { apiUrl } from '@/lib/api'

/** คีย์โปรไฟล์ใน settings — ชุดเดียวกับหน้า /dashboard/1/account (ข้อมูลชุดเดียวกัน ห้ามแยกเก็บ) */
const PROFILE_KEYS = [
  'account_full_name', 'account_nickname', 'account_gender', 'account_dob', 'account_phone', 'account_email',
] as const

/** ตัวเลือกเพศ — เก็บค่าเป็นอังกฤษใน settings · ป้ายแสดงผลตามที่กำหนด (เหมือนหน้า Account) */
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'lgbtq+', label: 'LGBTQ+' },
  { value: 'unspecified', label: 'ไม่ระบุ' },
]

/**
 * Placeholder "Input profile" บนหน้า /member/profile/user (วางใต้แผงผู้ใช้)
 * - ใช้ **ข้อมูลชุดเดียวกับหน้า /dashboard/1/account** คือ settings คีย์ `account_*` ผ่าน /api/settings (GET/PUT)
 * - ฟอร์มนี้อยู่ใน MemberLoginGate ของหน้าแล้ว → แสดงเฉพาะเมื่อล็อกอิน
 */
export function MemberInputProfilePanel() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  /** เดือนที่กำลังดูในปฏิทิน (null = ใช้เดือนของวันเกิดที่เลือกไว้) */
  const [dobMonth, setDobMonth] = useState<Date | null>(null)

  const field = (key: string) => values[key] ?? ''
  const setField = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }))

  // โหลดค่าชุดเดียวกับหน้า Account
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/settings'), { cache: 'no-store' })
        const settings: unknown = await response.json()
        if (cancelled) return
        const source = (typeof settings === 'object' && settings !== null ? settings : {}) as Record<string, unknown>
        const next: Record<string, string> = {}
        for (const key of PROFILE_KEYS) {
          if (typeof source[key] === 'string') next[key] = source[key] as string
        }
        setValues(next)
      } catch (error) {
        console.error('Failed to load profile settings', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const dob = field('account_dob') ? parseISO(field('account_dob')) : null
  const dobValid = !!dob && !Number.isNaN(dob.getTime())
  const dobText = dobValid ? format(dob as Date, 'd MMM yyyy') : '—'
  const dobFallbackMonth = dobValid ? (dob as Date) : new Date(1990, 0)
  const calMonth = dobMonth ?? dobFallbackMonth

  /** เลื่อนเดือนที่แสดงในปฏิทิน — จำกัดช่วง 1940-01 ถึงเดือนปัจจุบัน (เหมือนหน้า Account) */
  const shiftDobMonth = (months: number) => {
    const base = dobMonth ?? dobFallbackMonth
    const next = new Date(base.getFullYear(), base.getMonth() + months, 1)
    const min = new Date(1940, 0, 1)
    const max = new Date()
    setDobMonth(next < min ? min : next > max ? max : next)
  }

  /** บันทึกโปรไฟล์ — PUT ทีละคีย์ลง settings ชุดเดียวกับหน้า Account */
  const handleSaveAccount = async () => {
    setSaving(true)
    try {
      await Promise.all(PROFILE_KEYS.map((key) => fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: values[key] ?? '' }),
      })))
      toast.success('บันทึกโปรไฟล์สำเร็จ')
    } catch (error) {
      console.error('Failed to save profile settings', error)
      toast.error('บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-emerald-600" />
          Input profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ชื่อ-นามสกุล */}
        <div className="space-y-1.5">
          <Label htmlFor="account-full-name" className="text-xs text-muted-foreground">Full Name</Label>
          <Input
            id="account-full-name"
            value={field('account_full_name')}
            onChange={(e) => setField('account_full_name', e.target.value)}
            placeholder="ชื่อ-นามสกุล"
          />
        </div>

        {/* ชื่อเล่น */}
        <div className="space-y-1.5">
          <Label htmlFor="account-nickname" className="text-xs text-muted-foreground">NickName</Label>
          <Input
            id="account-nickname"
            value={field('account_nickname')}
            onChange={(e) => setField('account_nickname', e.target.value)}
            placeholder="ชื่อเล่น"
          />
        </div>

        {/* เพศ */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Gender</Label>
          <RadioGroup
            value={field('account_gender')}
            onValueChange={(val) => setField('account_gender', val)}
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            {GENDER_OPTIONS.map((g) => (
              <div key={g.value} className="flex items-center gap-2">
                <RadioGroupItem id={`account-gender-${g.value}`} value={g.value} />
                <Label htmlFor={`account-gender-${g.value}`} className="text-sm font-normal cursor-pointer">{g.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* วันเกิด — ปฏิทินพร้อมปุ่มเลื่อนเดือน/ปี (คัดลอกจากหน้า Account) */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">DOB</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="account-dob-trigger" type="button" variant="outline" className="w-full justify-start font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dobValid ? dobText : <span className="text-muted-foreground">เลือกวันเกิด</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {/* แถบเลื่อนเดือน/ปี — « » ทีละปี · ‹ › ทีละเดือน · แถวล่าง −10/+10 ปี (เหมือนหน้า Account) */}
              <div className="flex items-center justify-between gap-1 border-b px-2 py-2">
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" data-dob-nav="prev-year" aria-label="ปีก่อน" onClick={() => shiftDobMonth(-12)}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" data-dob-nav="prev-month" aria-label="เดือนก่อน" onClick={() => shiftDobMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <span data-field="dob-month-label" className="text-sm font-medium">{format(calMonth, 'MMMM yyyy')}</span>
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" data-dob-nav="next-month" aria-label="เดือนถัดไป" onClick={() => shiftDobMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" data-dob-nav="next-year" aria-label="ปีถัดไป" onClick={() => shiftDobMonth(12)}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 border-b px-2 py-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-xs" data-dob-nav="prev-10y" aria-label="ย้อน 10 ปี" onClick={() => shiftDobMonth(-120)}>−10 ปี</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-xs" data-dob-nav="next-10y" aria-label="ไปข้างหน้า 10 ปี" onClick={() => shiftDobMonth(120)}>+10 ปี</Button>
              </div>
              <Calendar
                mode="single"
                month={calMonth}
                onMonthChange={setDobMonth}
                selected={dobValid ? (dob as Date) : undefined}
                onSelect={(d) => setField('account_dob', d ? format(d, 'yyyy-MM-dd') : '')}
                startMonth={new Date(1940, 0)}
                endMonth={new Date()}
                classNames={{ nav: 'hidden', month_caption: 'hidden' }}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* เบอร์มือถือ */}
        <div className="space-y-1.5">
          <Label htmlFor="account-phone" className="text-xs text-muted-foreground">Mobile Phone</Label>
          <Input
            id="account-phone"
            type="tel"
            inputMode="tel"
            value={field('account_phone')}
            onChange={(e) => setField('account_phone', e.target.value)}
            placeholder="08x-xxx-xxxx"
          />
        </div>

        {/* อีเมล */}
        <div className="space-y-1.5">
          <Label htmlFor="account-email" className="text-xs text-muted-foreground">Email</Label>
          <Input
            id="account-email"
            type="email"
            value={field('account_email')}
            onChange={(e) => setField('account_email', e.target.value)}
            placeholder="name@example.com"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveAccount} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            บันทึกโปรไฟล์
          </Button>
          <span className="text-xs text-muted-foreground">ใช้ข้อมูลชุดเดียวกับหน้า Account (settings) — บันทึกลงฐานข้อมูล</span>
        </div>

      </CardContent>
    </Card>
  )
}

