'use client'

import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, MessageCircle, Save, User, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import type { LineMember, MessagingStatus, Settings } from './types'

/** ตัวเลือกเพศ — เก็บค่าเป็นอังกฤษใน settings · ป้ายแสดงผลตามที่กำหนด (Male / Female / LGBTQ+ / ไม่ระบุ) */
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'lgbtq+', label: 'LGBTQ+' },
  { value: 'unspecified', label: 'ไม่ระบุ' },
]

interface AccountSectionProps {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  saving: boolean
  handleSaveAccount: () => void
  lineConnected: boolean
  oaBasicId: string
  msgStatus: MessagingStatus | null
  lineMembers: LineMember[]
}

/** แถว label/value ฝั่ง View Profile */
function ProfileField({ label, value, field }: { label: string; value: string; field: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd data-field={field} className="text-sm truncate">{value}</dd>
    </div>
  )
}

/** Account (User) — ซ้าย 50%: ฟอร์ม Input profile · ขวา 50%: View Profile (รวม Line credential profile) */
export function AccountSection({ settings, setSettings, saving, handleSaveAccount, lineConnected, oaBasicId, msgStatus, lineMembers }: AccountSectionProps) {
  const field = (key: string) => settings[key] ?? ''
  const setField = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }))
  const v = (s?: string) => (s && s.trim() ? s : '—')

  const dob = settings.account_dob ? parseISO(settings.account_dob) : null
  const dobValid = !!dob && !Number.isNaN(dob.getTime())
  const dobText = dobValid ? format(dob as Date, 'd MMM yyyy') : '—'
  const genderText = GENDER_OPTIONS.find((g) => g.value === settings.account_gender)?.label
  const latestLine = lineMembers[0] ?? null
  const fullName = field('account_full_name')

  // ปฏิทิน DOB — เลื่อนดูเดือน/ปีด้วยปุ่มลูกศร (เลิกใช้ dropdown เพราะกดยาก/เพี้ยนบนมือถือ)
  const dobFallbackMonth = dobValid ? (dob as Date) : new Date(1990, 0)
  const [dobMonth, setDobMonth] = useState<Date | null>(null)
  const calMonth = dobMonth ?? dobFallbackMonth

  /** เลื่อนเดือนที่แสดงในปฏิทิน — จำกัดช่วง 1940-01 ถึงเดือนปัจจุบัน */
  const shiftDobMonth = (months: number) => {
    const base = dobMonth ?? dobFallbackMonth
    const next = new Date(base.getFullYear(), base.getMonth() + months, 1)
    const min = new Date(1940, 0, 1)
    const max = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    setDobMonth(next < min ? min : next > max ? max : next)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* ── ซ้าย: Input profile ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" />
            Input profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-full-name" className="text-xs text-muted-foreground">Full Name</Label>
            <Input id="account-full-name" value={fullName} onChange={(e) => setField('account_full_name', e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-nickname" className="text-xs text-muted-foreground">NickName</Label>
            <Input id="account-nickname" value={field('account_nickname')} onChange={(e) => setField('account_nickname', e.target.value)} placeholder="ชื่อเล่น" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Gender</Label>
            <RadioGroup value={field('account_gender')} onValueChange={(val) => setField('account_gender', val)} className="flex flex-wrap gap-x-5 gap-y-2">
              {GENDER_OPTIONS.map((g) => (
                <div key={g.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`account-gender-${g.value}`} value={g.value} />
                  <Label htmlFor={`account-gender-${g.value}`} className="text-sm font-normal cursor-pointer">{g.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

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
                {/* แถบเลื่อนเดือน/ปี — « » ทีละปี · ‹ › ทีละเดือน · แถวล่าง −10/+10 ปี (แทน dropdown เดิม) */}
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
                {/* กระโดดทีละ 10 ปี */}
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

          <div className="space-y-1.5">
            <Label htmlFor="account-phone" className="text-xs text-muted-foreground">Mobile Phone</Label>
            <Input id="account-phone" type="tel" inputMode="tel" value={field('account_phone')} onChange={(e) => setField('account_phone', e.target.value)} placeholder="08x-xxx-xxxx" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-email" className="text-xs text-muted-foreground">Email</Label>
            <Input id="account-email" type="email" value={field('account_email')} onChange={(e) => setField('account_email', e.target.value)} placeholder="name@example.com" />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveAccount} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              บันทึกโปรไฟล์
            </Button>
            <span className="text-xs text-muted-foreground">บันทึกลงฐานข้อมูล — รีเฟรชหน้าแล้วข้อมูลยังอยู่</span>
          </div>
        </CardContent>
      </Card>
      {/* ── ขวา: View Profile ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-600" />
            View Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {latestLine?.linePictureUrl ? (
              <img
                src={latestLine.linePictureUrl}
                alt={latestLine.lineDisplayName || latestLine.name || 'LINE profile'}
                className="h-14 w-14 rounded-full object-cover border shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-semibold shrink-0">
                {(fullName.trim() || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{v(fullName)}</p>
              <p className="text-xs text-muted-foreground truncate">
                {field('account_nickname').trim() ? `ชื่อเล่น: ${field('account_nickname')}` : 'ยังไม่ได้กรอกชื่อเล่น'}
              </p>
            </div>
          </div>

          <Separator />

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <ProfileField label="Full Name" value={v(fullName)} field="account_full_name" />
            <ProfileField label="NickName" value={v(field('account_nickname'))} field="account_nickname" />
            <ProfileField label="Gender" value={genderText || '—'} field="account_gender" />
            <ProfileField label="DOB" value={dobText} field="account_dob" />
            <ProfileField label="Mobile Phone" value={v(field('account_phone'))} field="account_phone" />
            <ProfileField label="Email" value={v(field('account_email'))} field="account_email" />
          </dl>

          <Separator />

          {/* Line credential profile — ข้อมูลเชื่อมต่อ LINE ของร้าน + โปรไฟล์ LINE ล่าสุด */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-sky-600" />
                Line credential profile
              </p>
              <Badge
                variant="outline"
                className={lineConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 text-xs'
                  : 'bg-muted text-muted-foreground text-xs'}
              >
                {lineConnected ? '● Connected' : '○ Not configured'}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <ProfileField label="LINE Channel ID" value={v(settings.line_channel_id)} field="line_channel_id" />
              <ProfileField label="LINE OA Basic ID" value={oaBasicId} field="line_oa_basic_id" />
              <ProfileField
                label="Messaging API"
                value={msgStatus?.connected ? `เชื่อมต่อแล้ว (ID: ${msgStatus.channelId || '—'})` : 'ยังไม่เชื่อมต่อ'}
                field="line_messaging"
              />
              <ProfileField
                label="LINE Login (ล่าสุด)"
                value={latestLine?.lineDisplayName || latestLine?.name || 'ยังไม่มีสมาชิก LINE Login'}
                field="line_display_name"
              />
            </dl>
            {latestLine && (
              <p className="text-[11px] text-muted-foreground">
                LINE User ID: {latestLine.lineUserId || '—'} · เข้าสู่ระบบล่าสุด{' '}
                {new Date(latestLine.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
