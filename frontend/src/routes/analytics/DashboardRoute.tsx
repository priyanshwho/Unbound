import { useParams } from 'react-router-dom'
import { AnalyticsRoute } from './AnalyticsRoute'

export function DashboardRoute() {
  const { dashboardId } = useParams()
  return <div data-dashboard-id={dashboardId}><AnalyticsRoute/></div>
}
