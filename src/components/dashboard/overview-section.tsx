'use client'

import { CalendarClock, CalendarDays, Check, Clock, LayoutDashboard, MapPin, Users, Wallet, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from './stat-card'
import type { Stats } from './types'

interface OverviewSectionProps {
  stats: Stats | null
}

/** Overview — สรุปตัวเลขวันนี้, การจองต่อสนาม, รายการจองล่าสุด */
export function OverviewSection({ stats }: OverviewSectionProps) {
  return (
    <>
      {/* Monitoring Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-emerald-600" />
            Monitoring — system overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Today bookings" value={stats?.today.count ?? 0} icon={CalendarDays} color="text-emerald-600" />
            <StatCard label="Active today" value={stats?.today.activeCount ?? 0} icon={CalendarClock} color="text-emerald-600" />
            <StatCard label="Upcoming" value={stats?.upcoming ?? 0} icon={CalendarClock} color="text-sky-600" />
            <StatCard label="Pending" value={stats?.status.pending ?? 0} icon={Clock} color="text-amber-600" />
            <StatCard label="Confirmed" value={stats?.status.confirmed ?? 0} icon={Check} color="text-emerald-600" />
            <StatCard label="Cancelled" value={stats?.status.cancelled ?? 0} icon={X} color="text-red-500" />
            <StatCard label="Total bookings" value={stats?.totals.bookings ?? 0} icon={CalendarDays} color="text-slate-700" />
            <StatCard label="LINE users" value={stats?.totals.users ?? 0} icon={Users} color="text-sky-600" />
            <StatCard label="Revenue today (est.)" value={stats?.today.revenueEstimate ?? 0} icon={Wallet} prefix="฿" color="text-emerald-700" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Today per court
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!stats || stats.today.byCourt.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No bookings today yet</p>
          )}
          {stats && stats.today.byCourt.map((c) => (
            <div key={c.courtId} className="flex items-center justify-between text-sm">
              <span className="font-medium">{c.name}</span>
              <Badge variant="secondary" className="text-xs">{c.count} booking{c.count === 1 ? '' : 's'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            Recent bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!stats || stats.recent.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent bookings</p>
          )}
          {stats && stats.recent.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm p-2.5 bg-muted/30 rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{b.playerName}</div>
                <div className="text-xs text-muted-foreground">
                  {b.bookingDate} · {b.court?.name ?? '-'} · {b.timeSlot?.startTime ?? ''}-{b.timeSlot?.endTime ?? ''}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">{b.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
