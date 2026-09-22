'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Dumbbell, MapPin, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PriceRule } from '@/lib/price'
import { CourtForm } from './court-form'
import { COURT_COLORS, COURT_ICONS, formatDays } from './helpers'
import { PriceRuleForm } from './price-rule-form'
import type { Court, Settings } from './types'

interface CourtSectionProps {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  handleSaveSetting: (key: string, value: string) => void
  courts: Court[]
  editingCourt: Court | null
  setEditingCourt: Dispatch<SetStateAction<Court | null>>
  handleSaveCourt: (data: Partial<Court>) => void
  handleDeleteCourt: (id: string) => void
  showNewCourt: boolean
  setShowNewCourt: Dispatch<SetStateAction<boolean>>
  priceRules: PriceRule[]
  editingPriceRule: PriceRule | null
  setEditingPriceRule: Dispatch<SetStateAction<PriceRule | null>>
  handleSavePriceRule: (data: Partial<PriceRule>) => void
  handleDeletePriceRule: (id: string) => void
  showNewPriceRule: boolean
  setShowNewPriceRule: Dispatch<SetStateAction<boolean>>
  saving: boolean
}

/** Court — ตั้งค่าข้อมูลสนาม, จัดการสนาม และราคาตามช่วงเวลา/วัน */
export function CourtSection({ settings, setSettings, handleSaveSetting, courts, editingCourt, setEditingCourt, handleSaveCourt, handleDeleteCourt, showNewCourt, setShowNewCourt, priceRules, editingPriceRule, setEditingPriceRule, handleSavePriceRule, handleDeletePriceRule, showNewPriceRule, setShowNewPriceRule, saving }: CourtSectionProps) {
  return (
    <>
      {/* Arena Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-emerald-600" />
            ข้อมูลสนาม
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ชื่อสนาม</Label>
            <Input
              value={settings.arena_name || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, arena_name: e.target.value }))}
              onBlur={(e) => handleSaveSetting('arena_name', e.target.value)}
              placeholder="P19 Pickleball Arena"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">เบอร์โทร</Label>
            <Input
              value={settings.arena_phone || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, arena_phone: e.target.value }))}
              onBlur={(e) => handleSaveSetting('arena_phone', e.target.value)}
              placeholder="02-xxx-xxxx"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ที่อยู่</Label>
            <Input
              value={settings.arena_address || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, arena_address: e.target.value }))}
              onBlur={(e) => handleSaveSetting('arena_address', e.target.value)}
              placeholder="ที่อยู่สนาม"
            />
          </div>
        </CardContent>
      </Card>

      {/* Courts Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              จัดการสนาม
              <Badge variant="secondary" className="text-xs">{courts.length}</Badge>
            </CardTitle>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => setShowNewCourt(true)}>
              <Plus className="h-3 w-3 mr-1" /> เพิ่มสนาม
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {courts.length === 0 && !showNewCourt && (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีสนาม</p>
          )}

          {courts.map((court, idx) => (
            <div key={court.id}>
              {editingCourt?.id === court.id ? (
                <CourtForm
                  initial={court}
                  onSave={handleSaveCourt}
                  onCancel={() => setEditingCourt(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                  <div className={`${COURT_COLORS[idx % COURT_COLORS.length]} text-white rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0`}>
                    {COURT_ICONS[idx % COURT_ICONS.length]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{court.name}</div>
                    <div className="text-xs text-muted-foreground">{court.description || '-'}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600"
                      onClick={() => setEditingCourt(court)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                      onClick={() => handleDeleteCourt(court.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showNewCourt && (
            <CourtForm
              initial={{ name: `สนาม ${courts.length + 1}`, sortOrder: courts.length + 1, isActive: true }}
              onSave={(data) => handleSaveCourt(data)}
              onCancel={() => setShowNewCourt(false)}
              saving={saving}
            />
          )}
        </CardContent>
      </Card>

      {/* Price Rules Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-violet-600" />
              ราคาตามช่วงเวลาและวัน
              <Badge variant="secondary" className="text-xs">{priceRules.length}</Badge>
            </CardTitle>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 h-7 text-xs" onClick={() => setShowNewPriceRule(true)}>
              <Plus className="h-3 w-3 mr-1" /> เพิ่มช่วงราคา
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            กำหนดราคาต่อชั่วโมงที่ต่างกันตามช่วงเวลาและวันในสัปดาห์ (ถ้าไม่มีช่วงที่ตรง ระบบจะใช้ราคาปกติของสนาม)
          </p>

          {priceRules.length === 0 && !showNewPriceRule && (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีช่วงราคา — ใช้ราคาปกติของสนามทุกช่วงเวลา</p>
          )}

          {priceRules.map((rule) => (
            <div key={rule.id}>
              {editingPriceRule?.id === rule.id ? (
                <PriceRuleForm
                  initial={rule}
                  onSave={handleSavePriceRule}
                  onCancel={() => setEditingPriceRule(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center gap-3 p-3 bg-violet-50/40 rounded-lg border border-violet-200">
                  <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                    <Tag className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {rule.name || formatDays(rule.days)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {rule.startTime} - {rule.endTime}
                      <span className="mx-1">•</span>
                      {formatDays(rule.days)}
                    </div>
                    <div className="text-xs font-semibold text-violet-700">฿{rule.price.toLocaleString()}/ชม.</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 hover:bg-violet-100 rounded-lg text-violet-600"
                      onClick={() => setEditingPriceRule(rule)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                      onClick={() => handleDeletePriceRule(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showNewPriceRule && (
            <PriceRuleForm
              initial={{ name: '', days: '', startTime: '08:00', endTime: '18:00', price: 300, sortOrder: priceRules.length + 1 }}
              onSave={(data) => handleSavePriceRule(data)}
              onCancel={() => setShowNewPriceRule(false)}
              saving={saving}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}
