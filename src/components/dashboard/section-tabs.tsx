'use client'

import { Clock, MapPin, MessageCircle, Receipt, Trophy } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

/** แถบแท็บแนวนอน — แสดงเฉพาะจอเล็ก (เดสก์ท็อปใช้ Sidebar แทน) */
export function SectionTabs() {
  return (
    <TabsList className="w-full lg:hidden mb-4 grid grid-cols-5">
      <TabsTrigger value="court" className="justify-center lg:justify-start lg:w-full lg:h-auto lg:rounded-lg gap-1.5">
        <MapPin className="h-4 w-4" /> <span className="font-medium">Court</span>
      </TabsTrigger>
      <TabsTrigger value="booking" className="justify-center lg:justify-start lg:w-full lg:h-auto lg:rounded-lg gap-1.5">
        <Clock className="h-4 w-4" /> <span className="font-medium">Tickets</span>
      </TabsTrigger>
      <TabsTrigger value="slip" className="justify-center lg:justify-start lg:w-full lg:h-auto lg:rounded-lg gap-1.5">
        <Receipt className="h-4 w-4" /> <span className="font-medium">Slip</span>
      </TabsTrigger>
      <TabsTrigger value="activity" className="justify-center lg:justify-start lg:w-full lg:h-auto lg:rounded-lg gap-1.5">
        <Trophy className="h-4 w-4" /> <span className="font-medium">กิจกรรม</span>
      </TabsTrigger>
      <TabsTrigger value="line" className="justify-center lg:justify-start lg:w-full lg:h-auto lg:rounded-lg gap-1.5">
        <MessageCircle className="h-4 w-4" /> <span className="font-medium">LINE</span>
      </TabsTrigger>
    </TabsList>
  )
}
