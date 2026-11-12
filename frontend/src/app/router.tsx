import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AnalyticsRoute } from '../routes/analytics/AnalyticsRoute'
import { ChatRoute } from '../routes/analytics/ChatRoute'
import { LandingRoute } from '../routes/landing/LandingRoute'
import { NotFoundRoute } from '../routes/NotFoundRoute'
import { SharedDashboardRoute } from '../routes/share/SharedDashboardRoute'

// The lazy route component is colocated with the router so chart code stays out of the landing bundle.
// oxlint-disable-next-line react/only-export-components
const DashboardRoute = lazy(() => import('../routes/analytics/DashboardRoute').then(module => ({ default: module.DashboardRoute })))

export const router = createBrowserRouter([
  { path: '/', element: <LandingRoute/> },
  { path: '/product', element: <Navigate to="/#features" replace/> },
  { path: '/workspace', element: <Navigate to="/analytics" replace/> },
  { path: '/analytics', element: <AnalyticsRoute/> },
  { path: '/analytics/chats/:chatId', element: <ChatRoute/> },
  { path: '/analytics/dashboards/:dashboardId', element: <Suspense fallback={<main className="grid min-h-screen place-items-center bg-background text-sm text-muted">Loading dashboard…</main>}><DashboardRoute/></Suspense> },
  { path: '/share/:shareId', element: <SharedDashboardRoute/> },
  { path: '*', element: <NotFoundRoute/> },
])
