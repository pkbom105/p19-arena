import { DashboardView } from '@/components/dashboard/dashboard-view'

export const metadata = { title: 'Dashboard — P19 Arena' }

/** /dashboard/1 → Court (default tab) */
export default function DashboardLevel1Page() {
  return <DashboardView initialSection="court" />
}
