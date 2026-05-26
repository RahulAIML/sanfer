import { lazy, memo, Suspense, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAppStore } from '../../store'

const AIAssistant = lazy(() =>
  import('../ai/AIAssistant').then((m) => ({ default: m.AIAssistant })),
)

export const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const mobileMenuOpen = useAppStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen)

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [theme])

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* Mobile overlay — sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 sm:p-5 lg:p-6 pb-6 max-w-[1600px] mx-auto page-fade">
            {children}
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <AIAssistant />
      </Suspense>
    </div>
  )
})
