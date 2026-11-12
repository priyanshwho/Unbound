import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AnalyticsRoute } from '../routes/analytics/AnalyticsRoute'
import { ChatRoute } from '../routes/analytics/ChatRoute'
import { LandingRoute } from '../routes/landing/LandingRoute'
import { NotFoundRoute } from '../routes/NotFoundRoute'
// Load chart dependencies only when a published snapshot is opened.
// oxlint-disable-next-line react/only-export-components
const SharedDashboardRoute = lazy(() => import('../routes/share/SharedDashboardRoute').then(module => ({ default: module.SharedDashboardRoute })))

// The lazy route component is colocated with the router so chart code stays out of the landing bundle.
// oxlint-disable-next-line react/only-export-components
const DashboardRoute = lazy(() => import('../routes/analytics/DashboardRoute').then(module => ({ default: module.DashboardRoute })))
// Reports reuse the saved aggregate dashboard payload and load only when opened.
// oxlint-disable-next-line react/only-export-components
const ReportRoute = lazy(() => import('../routes/analytics/ReportRoute').then(module => ({ default: module.ReportRoute })))

export const router = createBrowserRouter([
  { path: '/', element: <LandingRoute/> },
  { path: '/product', element: <Navigate to="/#features" replace/> },
  { path: '/workspace', element: <Navigate to="/analytics" replace/> },
  { path: '/analytics', element: <AnalyticsRoute/> },
  { path: '/analytics/chats/:chatId', element: <ChatRoute/> },
  { path: '/analytics/dashboards/:dashboardId', element: <Suspense fallback={<main className="grid min-h-screen place-items-center bg-background text-sm text-muted">Loading dashboard…</main>}><DashboardRoute/></Suspense> },
  { path: '/analytics/reports/:dashboardId', element: <Suspense fallback={<main className="grid min-h-screen place-items-center bg-background text-sm text-muted">Preparing report…</main>}><ReportRoute/></Suspense> },
  { path: '/share/:shareId', element: <Suspense fallback={<main className="grid min-h-screen place-items-center bg-background text-sm text-muted">Loading snapshot…</main>}><SharedDashboardRoute/></Suspense> },
  { path: '*', element: <NotFoundRoute/> },
])
