import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AnalyticsRoute } from '../routes/analytics/AnalyticsRoute'
import { ChatRoute } from '../routes/analytics/ChatRoute'
import { DashboardRoute } from '../routes/analytics/DashboardRoute'
import { LandingRoute } from '../routes/landing/LandingRoute'
import { NotFoundRoute } from '../routes/NotFoundRoute'
import { SharedDashboardRoute } from '../routes/share/SharedDashboardRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LandingRoute/> },
  { path: '/product', element: <Navigate to="/#features" replace/> },
  { path: '/workspace', element: <Navigate to="/analytics" replace/> },
  { path: '/analytics', element: <AnalyticsRoute/> },
  { path: '/analytics/chats/:chatId', element: <ChatRoute/> },
  { path: '/analytics/dashboards/:dashboardId', element: <DashboardRoute/> },
  { path: '/share/:shareId', element: <SharedDashboardRoute/> },
  { path: '*', element: <NotFoundRoute/> },
])
