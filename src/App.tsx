import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Shell } from './components/layout/Shell'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ChartSkeleton } from './components/ui/Skeleton'

const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const SimulationsPage = lazy(() => import('./pages/SimulationsPage'))
const ConversationalPage = lazy(() => import('./pages/ConversationalPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'))
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'))
const CoachingPage = lazy(() => import('./pages/CoachingPage'))
const BusinessLinesPage = lazy(() => import('./pages/BusinessLinesPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2, refetchOnWindowFocus: false },
  },
})

function PageFallback() {
  return (
    <div className="p-6 space-y-4">
      <ChartSkeleton height={120} />
      <ChartSkeleton height={280} />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/simulations" element={<SimulationsPage />} />
                <Route path="/conversational" element={<ConversationalPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/organization" element={<OrganizationPage />} />
                <Route path="/coaching" element={<CoachingPage />} />
                <Route path="/business-lines" element={<BusinessLinesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Shell>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
