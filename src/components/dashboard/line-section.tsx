'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Copy, ExternalLink, Loader2, MessageCircle, Save, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LineMember, MessagingStatus, Settings } from './types'

interface LineSectionProps {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  lineConnected: boolean
  handleSaveLine: () => void
  msgStatus: MessagingStatus | null
  msgChannelId: string
  setMsgChannelId: Dispatch<SetStateAction<string>>
  msgChannelSecret: string
  setMsgChannelSecret: Dispatch<SetStateAction<string>>
  isSavingMsg: boolean
  handleSaveMessaging: () => void
  oaBasicId: string
  oaManagerChatUrl: string
  oaCustomerChatUrl: string
  handleCopyCustomerChatLink: () => void
  handleSaveOaBasicId: () => void
  lineMembers: LineMember[]
}

/** LINE Credential — LINE Login, Messaging API, ปุ่มแชท LINE OA และรายชื่อสมาชิก LINE */
export function LineSection({ settings, setSettings, lineConnected, handleSaveLine, msgStatus, msgChannelId, setMsgChannelId, msgChannelSecret, setMsgChannelSecret, isSavingMsg, handleSaveMessaging, oaBasicId, oaManagerChatUrl, oaCustomerChatUrl, handleCopyCustomerChatLink, handleSaveOaBasicId, lineMembers }: LineSectionProps) {
  return (
    <>
      {/* LINE Credential settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-sky-600" />
              LINE Credential
            </CardTitle>
            <Badge
              variant="outline"
              className={lineConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-muted text-muted-foreground'}
            >
              {lineConnected ? '● Connected' : '○ Not configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            ตั้งค่า LINE Login สำหรับการเข้าสู่ระบบด้วย LINE (Channel ID + Channel Secret จาก LINE Developers Console)
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">LINE Channel ID (NEXT_PUBLIC_LINE_CHANNEL_ID)</Label>
            <Input
              value={settings.line_channel_id || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, line_channel_id: e.target.value }))}
              placeholder="2011357077"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">LINE Channel Secret (LINE_CHANNEL_SECRET)</Label>
            <Input
              type="password"
              value={settings.line_channel_secret || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, line_channel_secret: e.target.value }))}
              placeholder="••••••••••••••••"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 h-8 text-xs"
              onClick={handleSaveLine}
              disabled={!settings.line_channel_id?.trim()}
            >
              <Save className="h-3 w-3 mr-1" /> Save LINE
            </Button>
            <span className="text-xs text-muted-foreground">
              {lineConnected ? 'Line login enabled' : 'กรอก Channel ID/Secret แล้วกด Save'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Channel Secret แสดงเป็น * เมื่อบันทึกแล้ว — ถ้าไม่แก้จะไม่ทับค่าเดิม (save button)
          </p>
        </CardContent>
      </Card>

      {/* Messaging API — ส่งตั๋วเข้าแชท LINE (Push) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" />
              Messaging API — ส่งตั๋วเข้าแชท
            </CardTitle>
            <Badge
              variant="outline"
              className={msgStatus?.connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-muted text-muted-foreground'}
            >
              {msgStatus?.connected ? '● Connected' : '○ Not configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            ส่งตั๋วเข้าแชท LINE ของลูกค้าอัตโนมัติหลังจองสำเร็จ — ใช้ Channel ของ{' '}
            <span className="font-medium">Messaging API</span> จาก LINE Official Account (Channel ID ขึ้นต้น 200…)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Channel ID</Label>
              <Input
                value={msgChannelId}
                onChange={(e) => setMsgChannelId(e.target.value)}
                placeholder="เช่น 2011436516"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Channel Secret</Label>
              <Input
                type="password"
                value={msgChannelSecret}
                onChange={(e) => setMsgChannelSecret(e.target.value)}
                placeholder={msgStatus?.connected ? '•••••••••••••••• (บันทึกแล้ว)' : 'ความลับแชนแนล'}
              />
            </div>
          </div>
          {msgStatus?.connected && msgStatus.tokenExpiresAt && (
            <p className="text-xs text-muted-foreground">
              Access token หมดอายุ {new Date(msgStatus.tokenExpiresAt).toLocaleDateString('th-TH')} — ระบบต่ออายุอัตโนมัติ
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 h-8 text-xs"
              onClick={handleSaveMessaging}
              disabled={isSavingMsg || !msgChannelId.trim()}
            >
              {isSavingMsg ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              {isSavingMsg ? 'กำลังทดสอบ...' : 'Save Messaging'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {msgStatus?.connected ? `เชื่อมต่อแล้ว (ID: ${msgStatus.channelId})` : 'กด Save = ทดสอบกับ LINE ทันที'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* แชท LINE — ปุ่มเปิดแชท (ไม่ต้องเขียนโค้ด / ไม่ต้อง webhook) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              แชท LINE
            </CardTitle>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
              {oaBasicId}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            เปิดหน้าจอแชทกับลูกค้าได้ในคลิกเดียว — ข้อความทั้งหมดยังเข้ามาที่{' '}
            <span className="font-medium">LINE Official Account Manager</span> และแอป LINE ของ OA เหมือนเดิม
            (การเพิ่มปุ่มนี้ไม่กระทบการรับข้อความ ไม่ต้อง webhook ไม่ต้องเขียนโค้ด)
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">LINE OA Basic ID</Label>
            <Input
              value={settings.line_oa_basic_id ?? ''}
              onChange={(e) => setSettings(prev => ({ ...prev, line_oa_basic_id: e.target.value }))}
              placeholder="@323xcbvy"
            />
            <p className="text-[11px] text-muted-foreground">
              ถ้าเว้นว่าง ระบบใช้ค่าเริ่มต้น <span className="font-medium">@323xcbvy</span> — แก้ ID แล้วกด Save ได้เลยโดยไม่ต้องแก้โค้ด
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
              onClick={() => window.open(oaManagerChatUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              เปิดแชท LINE (สำหรับผู้ดูแล)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => window.open(oaCustomerChatUrl, '_blank', 'noopener,noreferrer')}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              ลิงก์แชทสำหรับลูกค้า (มือถือ)
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleCopyCustomerChatLink}>
              <Copy className="h-3 w-3 mr-1" />
              คัดลอกลิงก์
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveOaBasicId}>
              <Save className="h-3 w-3 mr-1" />
              Save ID
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            💡 ปุ่มนี้เป็น "ลิงก์เปิดแชท" เท่านั้น — ไม่ได้ดึงข้อความมาแสดงในเว็บ
            (LINE URL scheme ไม่รองรับบน LINE for PC จึงเปิดผ่าน LINE OA Manager บนเดสก์ท็อป)
          </p>
        </CardContent>
      </Card>

      {/* LINE Members — สมาชิกที่เข้าสู่ระบบด้วย LINE */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-600" />
              สมาชิก LINE Login
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {lineMembers.length} คน
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            รายชื่อสมาชิกที่เข้าสู่ระบบด้วย LINE — เรียงจากคนล่าสุด
          </p>

          {lineMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีสมาชิก LINE Login</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {lineMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                {m.linePictureUrl ? (
                  <img
                    src={m.linePictureUrl}
                    alt={m.lineDisplayName || m.name || 'LINE user'}
                    className="h-10 w-10 rounded-full object-cover border shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-semibold shrink-0">
                    {(m.lineDisplayName || m.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.lineDisplayName || m.name || 'ไม่ทราบชื่อ'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.phone || m.lineUserId || '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-emerald-700">{m._count.bookings} จอง</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
