'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EquipmentForm } from './equipment-form'
import type { Equipment } from './types'

interface EquipmentSectionProps {
  equipment: Equipment[]
  editingEquipment: Equipment | null
  setEditingEquipment: Dispatch<SetStateAction<Equipment | null>>
  handleSaveEquipment: (data: Partial<Equipment>) => void
  handleDeleteEquipment: (id: string) => void
  showNewEquipment: boolean
  setShowNewEquipment: Dispatch<SetStateAction<boolean>>
  saving: boolean
}

/** Equipment — อุปกรณ์ให้เช่า เพิ่ม/แก้ไข/ลบ */
export function EquipmentSection({ equipment, editingEquipment, setEditingEquipment, handleSaveEquipment, handleDeleteEquipment, showNewEquipment, setShowNewEquipment, saving }: EquipmentSectionProps) {
  return (
    <>
      {/* Rental Equipment Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-600" />
              อุปกรณ์เช่า
              <Badge variant="secondary" className="text-xs">{equipment.length}</Badge>
            </CardTitle>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => setShowNewEquipment(true)}>
              <Plus className="h-3 w-3 mr-1" /> เพิ่มอุปกรณ์
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {equipment.length === 0 && !showNewEquipment && (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีอุปกรณ์เช่า</p>
          )}

          {equipment.map((item) => (
            <div key={item.id}>
              {editingEquipment?.id === item.id ? (
                <EquipmentForm
                  initial={item}
                  onSave={handleSaveEquipment}
                  onCancel={() => setEditingEquipment(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-lg">🏸</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.nameEn || ''}</div>
                    <div className="text-xs font-semibold text-amber-700">฿{item.pricePerUnit.toLocaleString()}/ชิ้น</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600"
                      onClick={() => setEditingEquipment(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                      onClick={() => handleDeleteEquipment(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showNewEquipment && (
            <EquipmentForm
              initial={{ name: '', pricePerUnit: 50, sortOrder: equipment.length + 1, isActive: true }}
              onSave={(data) => handleSaveEquipment(data)}
              onCancel={() => setShowNewEquipment(false)}
              saving={saving}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}
