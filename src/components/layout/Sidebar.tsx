import { memo, useState, useEffect } from 'react'
import {
  LayoutDashboard, PlayCircle, MessageSquare, Brain, Trophy,
  Activity, Building2, ChevronLeft, ChevronRight,
  GitBranch, FileText, Settings, X, BadgeCheck,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { cn } from '../../lib/cn'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  key: string
  exact?: boolean
}

interface NavGroup {
  label: { es: string; en: string }
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: { es: 'Vista General', en: 'General View' },
    items: [{ to: '/', icon: LayoutDashboard, key: 'nav_overview', exact: true }],
  },
  {
    label: { es: 'Simulador', en: 'Simulator' },
    items: [
      { to: '/certification', icon: BadgeCheck, key: 'nav_certification' },
      { to: '/simulations', icon: PlayCircle, key: 'nav_simulations' },
      { to: '/conversational', icon: MessageSquare, key: 'nav_conversational' },
      { to: '/coaching', icon: Brain, key: 'nav_coaching' },
      { to: '/leaderboard', icon: Trophy, key: 'nav_leaderboard' },
    ],
  },
  {
    label: { es: 'Plataforma', en: 'Platform' },
    items: [
      { to: '/activities', icon: Activity, key: 'nav_activities' },
      { to: '/organization', icon: Building2, key: 'nav_organization' },
      { to: '/business-lines', icon: GitBranch, key: 'nav_business_lines' },
    ],
  },
  {
    label: { es: 'Más', en: 'More' },
    items: [
      { to: '/reports', icon: FileText, key: 'nav_reports' },
      { to: '/settings', icon: Settings, key: 'nav_settings' },
    ],
  },
]

const NavContent = memo(function NavContent({
  collapsed,
  onNavClick,
  language,
}: {
  collapsed: boolean
  onNavClick?: () => void
  language: string
}) {
  const t = useTranslation(language)
  const es = language === 'es'

  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
          {gi > 0 && (
            collapsed ? (
              <div className="mx-3 my-2 border-t border-white/10" />
            ) : (
              <p className="px-5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30 select-none">
                {es ? group.label.es : group.label.en}
              </p>
            )
          )}

          <div className="space-y-px px-2">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={onNavClick}
                title={collapsed ? t(item.key) : undefined}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group',
                    isActive
                      ? 'text-white bg-white/[0.10]'
                      : 'text-white/50 hover:text-white/90 hover:bg-white/[0.06]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
                    )}
                    <item.icon
                      className={cn(
                        'w-[15px] h-[15px] shrink-0 transition-colors',
                        isActive ? 'text-accent' : 'text-white/40 group-hover:text-white/70',
                      )}
                    />
                    <span className={cn(
                      'whitespace-nowrap transition-[opacity,width] duration-150 leading-none',
                      collapsed ? 'opacity-0 w-0 overflow-hidden pointer-events-none' : 'opacity-100',
                    )}>
                      {t(item.key)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
})

export const Sidebar = memo(function Sidebar() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const mobileMenuOpen = useAppStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen)
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)

  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (!mobileMenuOpen) setClosing(false)
  }, [mobileMenuOpen])

  function closeMobile() {
    setClosing(true)
    setTimeout(() => setMobileMenuOpen(false), 220)
  }

  const LogoArea = ({ height = 32, showName = true }: { height?: number; showName?: boolean }) => (
    <div className="flex items-center gap-3 min-w-0 px-4">
      <img src="/sanfer-logo.svg" alt="Sanfer" className="w-auto shrink-0" style={{ height }} />
      {showName && (
        <div className={cn(
          'flex flex-col min-w-0 overflow-hidden transition-[opacity,width] duration-150',
          sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100',
        )}>
          <span className="text-[13px] font-semibold text-white leading-tight tracking-tight whitespace-nowrap">
            Sanfer
          </span>
          <span className="text-[10px] text-white/40 leading-tight whitespace-nowrap">
            {t('sidebar_tagline')}
          </span>
        </div>
      )}
    </div>
  )

  const navyStyle = { background: '#0B1D3A' }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        style={{ width: sidebarCollapsed ? 64 : 232, ...navyStyle }}
        className="relative hidden lg:flex flex-col border-r border-white/10 h-screen shrink-0 overflow-hidden z-20 transition-[width] duration-200 ease-in-out"
      >
        {/* Logo */}
        <div className="h-14 flex items-center border-b border-white/10 shrink-0">
          <LogoArea />
        </div>

        <NavContent collapsed={sidebarCollapsed} language={language} />

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all z-30 shadow-sm"
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Mobile drawer ── */}
      {(mobileMenuOpen || closing) && (
        <>
          <div
            className={cn(
              'fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-220',
              closing ? 'opacity-0' : 'opacity-100',
            )}
            onClick={closeMobile}
          />
          <aside
            style={navyStyle}
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[232px] flex flex-col border-r border-white/10 lg:hidden',
              closing ? 'translate-x-[-260px] transition-transform duration-[220ms] ease-in' : 'animate-slide-in-left',
            )}
          >
            <div className="h-14 flex items-center justify-between border-b border-white/10 shrink-0 pr-3">
              <div className="flex items-center gap-3 px-4">
                <img src="/sanfer-logo.svg" alt="Sanfer" className="w-auto shrink-0" style={{ height: 28 }} />
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-white leading-tight">Sanfer</span>
                  <span className="text-[10px] text-white/40 leading-tight">{t('sidebar_tagline')}</span>
                </div>
              </div>
              <button
                onClick={closeMobile}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <NavContent collapsed={false} language={language} onNavClick={closeMobile} />
          </aside>
        </>
      )}
    </>
  )
})
