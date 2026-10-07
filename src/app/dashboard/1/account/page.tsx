'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { AccountSection } from '@/components/dashboard/account-section'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { LineMember, MessagingStatus, Settings } from '@/components/dashboard/types'

/**
 * โปรไฟล์ผู้ใช้ (/dashboard/1/account) — หน้าของตัวเอง (ไม่ใช่แท็บของ Dashboard)
 * โหลดข้อมูลเอง (settings / users / line-messaging) แล้วส่งให้ AccountSection ที่แยกไฟล์ไว้แล้ว
 */
export default function AccountPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [lineMembers, setLineMembers] = useState<LineMember[]>([])
  const [msgStatus, setMsgStatus] = useState<MessagingStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [sRes, uRes, mRes] = await Promise.all([
        fetch(apiUrl('/api/settings')),
        fetch(apiUrl('/api/users')),
        fetch(apiUrl('/api/line-messaging')),
      ])
      setSettings(await sRes.json())
      const users = await uRes.json()
      if (Array.isArray(users)) setLineMembers(users)
      const msg = await mRes.json().catch(() => null)
      if (msg && !msg.error) setMsgStatus(msg)
    } catch (err) {
      console.error('Failed to load account data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // LINE Login — สถานะเชื่อมต่อ + ลิงก์แชท OA (คำนวณแบบเดียวกับหน้า Dashboard)
  const lineConnected = !!(settings.line_channel_id?.trim() && settings.line_channel_secret?.trim())
  const oaBasicId = (settings.line_oa_basic_id || '').trim() || '@323xcbvy'
  const oaManagerChatUrl = `https://manager.line.biz/account/@${oaBasicId.replace(/^@/, '')}/chat`

  /** บันทึกโปรไฟล์ลง settings (PUT ทีละ key แบบเดียวกับหน้า Line credential) */
  const handleSaveAccount = async () => {
    setSaving(true)
    try {
      const keys = ['account_full_name', 'account_nickname', 'account_gender', 'account_dob', 'account_phone', 'account_email']
      await Promise.all(keys.map((key) => fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: settings[key] ?? '' }),
      })))
      toast.success('บันทึกโปรไฟล์สำเร็จ')
      load()
    } catch {
      toast.error('บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell oaManagerChatUrl={oaManagerChatUrl} mobileTabs>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <AccountSection
          settings={settings}
          setSettings={setSettings}
          saving={saving}
          handleSaveAccount={handleSaveAccount}
          lineConnected={lineConnected}
          oaBasicId={oaBasicId}
          msgStatus={msgStatus}
          lineMembers={lineMembers}
        />
      )}
    </DashboardShell>
  )
}