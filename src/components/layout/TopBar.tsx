import { Globe, RefreshCw, Sun, Moon, Menu } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore, type Language } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { cn } from '../../lib/cn'

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'ES', flag: '🇲🇽' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
]

export function TopBar() {
  const { language, setLanguage, theme, toggleTheme, toggleMobileMenu } = useAppStore()
  const t = useTranslation(language)
  const queryClient = useQueryClient()

  return (
    <header className="h-14 bg-surface border-b border-line/40 flex items-center justify-between px-3 sm:px-5 shrink-0 z-10">
      {/* Left: hamburger (mobile) + brand (desktop) */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden btn-ghost p-2"
          title="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <span className="hidden lg:block text-xs text-slate-500 font-medium tracking-wide uppercase">
          {t('platform_tagline')}
        </span>
      </div>

      {/* Right: Controls */}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => queryClient.invalidateQueries()}
          title="Refresh data"
          className="btn-ghost p-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="btn-ghost p-2"
        >
          {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>
        <div className="flex items-center gap-1 bg-card border border-line/60 rounded-lg p-1">
          <Globe className="w-3 h-3 text-slate-500 ml-1 hidden sm:block" />
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-medium transition-all duration-150',
                language === l.code ? 'bg-accent/15 text-accent' : 'text-slate-500 hover:text-slate-400',
              )}
            >
              <span className="mr-0.5">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
