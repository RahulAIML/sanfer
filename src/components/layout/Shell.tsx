import { useEffect, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AIAssistant } from '../ai/AIAssistant'
import { useAppStore } from '../../store'

export function Shell({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const { mobileMenuOpen, setMobileMenuOpen } = useAppStore()

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
      <AIAssistant />
    </div>
  )
}
