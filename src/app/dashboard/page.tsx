import { DashboardView } from '@/components/dashboard/dashboard-view'

export const metadata = { title: 'Dashboard — P19 Arena' }

/** /dashboard → Overview (default tab) */
export default function DashboardPage() {
  return <DashboardView initialSection="overview" />
}
