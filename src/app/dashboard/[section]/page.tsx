import { notFound } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'

const VALID_SECTIONS = ['overview', 'court', 'equipment', 'booking', 'slip', 'line'] as const

export const metadata = { title: 'Dashboard — P19 Arena' }

/** prerender หน้า tab ที่รู้จักตอน build (production/standalone) */
export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }))
}

/** /dashboard/<section> → เปิด Dashboard ที่ tab นั้น (URL ต่อแท็บ) */
export default async function DashboardSectionPage({ params }: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!VALID_SECTIONS.includes(section as (typeof VALID_SECTIONS)[number])) {
    notFound()
  }
  return <DashboardView initialSection={section} />
}
