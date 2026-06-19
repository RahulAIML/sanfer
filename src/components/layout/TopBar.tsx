import { memo } from 'react'
import { Globe, RefreshCw, Sun, Moon, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore, type Language } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { cn } from '../../lib/cn'

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'ES', flag: '🇲🇽' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
]

const ROUTE_KEYS: Record<string, string> = {
  '/':               'nav_overview',
  '/simulations':    'nav_simulations',
  '/certification':  'nav_certification',
  '/conversational': 'nav_conversational',
  '/coaching':       'nav_coaching',
  '/leaderboard':    'nav_leaderboard',
  '/activities':     'nav_activities',
  '/organization':   'nav_organization',
  '/business-lines': 'nav_business_lines',
  '/reports':        'nav_reports',
  '/settings':       'nav_settings',
}

export const TopBar = memo(function TopBar() {
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const toggleMobileMenu = useAppStore((s) => s.toggleMobileMenu)
  const t = useTranslation(language)
  const queryClient = useQueryClient()
  const { pathname } = useLocation()

  const pageKey = ROUTE_KEYS[pathname]
  const pageLabel = pageKey ? t(pageKey) : ''

  return (
    <header className="h-14 bg-surface border-b border-line/40 flex items-center justify-between px-4 sm:px-5 shrink-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden btn-ghost p-1.5"
          title="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Page name (desktop) */}
        {pageLabel && (
          <div className="hidden lg:flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] text-slate-600 font-medium uppercase tracking-[0.1em]">
              {t('platform_tagline')}
            </span>
            <span className="text-slate-700 text-xs select-none">·</span>
            <span className="text-[13px] font-semibold text-slate-300 truncate">
              {pageLabel}
            </span>
          </div>
        )}
        {!pageLabel && (
          <span className="hidden lg:block text-[11px] text-slate-600 font-medium uppercase tracking-[0.1em]">
            {t('platform_tagline')}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => queryClient.invalidateQueries()}
          title="Refresh data"
          className="btn-ghost p-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="btn-ghost p-1.5"
        >
          {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Language switcher */}
        <div className="flex items-center gap-0.5 ml-1 bg-card border border-line/50 rounded-lg p-1">
          <Globe className="w-3 h-3 text-slate-600 ml-1 hidden sm:block" />
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-semibold transition-all duration-150',
                language === l.code
                  ? 'bg-accent/15 text-accent'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <span className="mr-0.5 text-[10px]">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
})
