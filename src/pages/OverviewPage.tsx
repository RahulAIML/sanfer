import { memo, useState, useMemo, useRef, useEffect } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import {
  computeKPIs, computeActivityStats, computeUserStats, computeScoreDistribution, normalizeName,
} from '../lib/analytics'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { CERT_TOTAL_SLOTS } from '../lib/certification'
import { useSimulations, useTopStats, useCertCount } from '../api/queries'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { downloadCSV, csvDate } from '../lib/csvExport'
import { matchesSearch } from '../lib/searchUtils'
import {
  Users, Download, Search, ChevronDown, X,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'

const COLORS = { pass: '#10F5A0', fail: '#FF4D4D', accent: '#00D4FF', violet: '#A855F7' }

function TrendTooltip({ active, payload, label, es, c }: { active?: boolean; payload?: any[]; label?: string; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell c={c} minWidth={160}>
      <TTitle text={String(label ?? '')} c={c} />
      <TRow label={es ? 'Puntaje Prom.' : 'Avg Score'} value={`${payload[0]?.value ?? 0}%`} valueStyle={{ color: c.accent }} c={c} />
    </TooltipShell>
  )
}

function ActivityTooltip({ active, payload, es, c }: { active?: boolean; payload?: any[]; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell c={c} minWidth={160}>
      <TTitle text={d.payload.name} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'} value={d.value} valueStyle={{ color: c.accent }} c={c} />
    </TooltipShell>
  )
}

function ScoreDistTooltip({ active, payload, es, c }: { active?: boolean; payload?: any[]; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell c={c} minWidth={140}>
      <TTitle text={d.payload.label} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'} value={d.value} valueStyle={{ color: c.accent }} c={c} />
    </TooltipShell>
  )
}

export default function OverviewPage() {
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)
  const es = language === 'es'

  const c  = useChartColors()
  const tt = useTooltipColors()

  const {
    simsLoading, activitiesLoading, isError,
    quickKpis,          // ← available as soon as sims arrive (no org wait)
    kpis, trend, scoreDist, actStats, userStats,
    sims, activities, members, admins,
    refetch,
  } = useDashboardData()

  // Cert % — DB-authoritative count divided by total members.
  const { data: dbCertCount } = useCertCount()
  const certPct = useMemo(() => {
    if (dbCertCount == null || !kpis?.totalMembers) return null
    return Math.round((dbCertCount / kpis.totalMembers) * 100)
  }, [dbCertCount, kpis?.totalMembers])

  // Skeleton only while sims are loading — activities are cached 24 h and arrive
  // almost immediately on any warm session.
  const isLoading = simsLoading

  // Below-fold sections mount lazily when they scroll into view.
  // rootMargin: start loading 120 px before entering the viewport.
  const [belowFoldRef, belowFoldVisible] = useIntersectionObserver({ rootMargin: '120px' })
  const [scoreSentRef, scoreVisible]     = useIntersectionObserver({ rootMargin: '80px' })
  // ── Date range — driven by global Zustand store ─────────────────────────────
  const dateFrom     = useAppStore((s) => s.dateFrom)
  const dateTo       = useAppStore((s) => s.dateTo)
  const setDateRange = useAppStore((s) => s.setDateRange)
  // Convert null → '' so date inputs don't see a controlled→uncontrolled flip
  const from = dateFrom ?? ''
  const to   = dateTo   ?? ''

  // ── User selection filter ────────────────────
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  const allUserNames = useMemo(
    () => Array.from(new Set(sims.map((s) => s.Usuario_Nombre).filter((n): n is string => !!n))).sort(),
    [sims],
  )
  const filteredUserNames = useMemo(
    () => userSearch.trim()
      ? allUserNames.filter((n) => matchesSearch(userSearch, n))
      : allUserNames,
    [allUserNames, userSearch],
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleUser(name: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // ── Filter sims by selected users ──────────────────────────────────────────
  // Date filtering is handled globally in useDashboardData (reads from store),
  // so `sims` here is already date-filtered. We only need the user-level slice.
  const filteredSims = useMemo(() => {
    if (selectedUsers.size === 0) return sims
    return sims.filter((s) => s.Usuario_Nombre && selectedUsers.has(s.Usuario_Nombre))
  }, [sims, selectedUsers])

  // anyFilterActive: badge / UX indicator (date filter OR user filter)
  const anyFilterActive  = !!(dateFrom || dateTo) || selectedUsers.size > 0
  // userFilterActive: only re-derive stats when the user-level filter adds a slice on top
  const userFilterActive = selectedUsers.size > 0

  // Re-derive all stats from user-filtered sims when user filter is active.
  // When only a date filter is set, the hook already provides correct stats.
  // Fall back to quickKpis (sims-only) while full kpis is still computing.
  const activeKpis     = useMemo(
    () => userFilterActive ? computeKPIs(filteredSims, activities, members, admins) : (kpis ?? quickKpis),
    [userFilterActive, filteredSims, activities, members, admins, kpis, quickKpis],
  )
  const activeActStats = useMemo(() => userFilterActive ? computeActivityStats(filteredSims, activities) : actStats, [userFilterActive, filteredSims, activities, actStats])
  const activeScoreDist= useMemo(() => userFilterActive ? computeScoreDistribution(filteredSims) : scoreDist,        [userFilterActive, filteredSims, scoreDist])
  const activeUserStats= useMemo(() => userFilterActive ? computeUserStats(filteredSims) : userStats,                [userFilterActive, filteredSims, userStats])

  // avg_best_score from TopStats matches the official platform's "Average Rating"
  // (average of each user's best score all-time). Only use when no filter is active.
  const topStatsQ  = useTopStats()
  const avgDisplay = useMemo(() => {
    if (!activeKpis) return '…'
    if (!anyFilterActive && topStatsQ.data?.stats.avg_best_score != null)
      return `${topStatsQ.data.stats.avg_best_score}%`
    return `${activeKpis.averageScore}%`
  }, [activeKpis, anyFilterActive, topStatsQ.data])

  // trend from useDashboardData is already date-filtered — use it directly
  const filteredTrend  = trend ?? []
  const simsSparkData  = useMemo(() => filteredTrend.slice(-20).map((d) => d.count),    [filteredTrend])
  const scoreSparkData = useMemo(() => filteredTrend.slice(-20).map((d) => d.avgScore), [filteredTrend])
  const advisorsSparkData = useMemo(() => {
    const byDate = new Map<string, Set<string>>()
    filteredSims.forEach((s) => {
      const d = s.Fecha_y_Hora?.slice(0, 10)
      if (!d || !s.Usuario_Nombre) return
      if (!byDate.has(d)) byDate.set(d, new Set())
      byDate.get(d)!.add(s.Usuario_Nombre)
    })
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([, users]) => users.size)
  }, [filteredSims])

  // ── CSV exports ─────────────────────────────
  function exportSimCSV() {
    if (!activeKpis) return
    downloadCSV([
      [es ? 'Métrica' : 'Metric',              es ? 'Valor' : 'Value'],
      [es ? 'Total Simulaciones' : 'Total Simulations', activeKpis.totalSimulations],
      [es ? 'Puntaje Promedio'   : 'Average Score',     `${activeKpis.averageScore}%`],
      [es ? 'Asesores Activos'   : 'Active Advisors',   activeKpis.activeAdvisors],
      ...(activeActStats ?? []).map((a) => [a.name, a.count]),
    ], `sanfer_sim_overview_${csvDate()}.csv`)
  }

  // ── Loading / error ──────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 h-28 skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 h-60 sm:h-80 skeleton rounded-xl lg:col-span-2" />
          <div className="card p-5 h-60 sm:h-80 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  // Only hard-error if sims failed (can't show anything meaningful)
  if ((isError && !quickKpis) || (!anyFilterActive && !activeKpis && !simsLoading)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={refetch} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  const topActivities = (activeActStats ?? []).slice(0, 5).map((a) => ({
    name: a.name.length > 24 ? a.name.slice(0, 24) + '...' : a.name,
    count: a.count,
  }))

  return (
    <div className="space-y-6">
      {/* Header + date range + exports */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_overview_title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('page_overview_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            from={from} to={to}
            onApply={(f, t) => setDateRange(f || null, t || null)}
            label={es ? 'Período' : 'Period'}
          />
          {/* User filter dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown((v) => !v)}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-all ${
                selectedUsers.size > 0
                  ? 'text-accent border-accent/40 bg-accent/5'
                  : 'text-slate-400 hover:text-slate-200 border-line/50 hover:border-line'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {selectedUsers.size > 0
                ? `${selectedUsers.size} ${es ? 'asesor(es)' : 'advisor(s)'}`
                : (es ? 'Asesores' : 'Advisors')}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {showUserDropdown && (
              <div className="absolute top-full mt-1 right-0 z-30 w-56 sm:w-64 bg-surface border border-line rounded-xl shadow-elevated overflow-hidden">
                <div className="p-2 border-b border-line/30">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={es ? 'Buscar...' : 'Search...'}
                      className="w-full bg-card border border-line/50 text-slate-300 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                {selectedUsers.size > 0 && (
                  <div className="px-3 py-1.5 border-b border-line/30">
                    <button
                      onClick={() => setSelectedUsers(new Set())}
                      className="text-[11px] text-danger hover:text-red-400 flex items-center gap-1"
                    >
                      <X className="w-2.5 h-2.5" /> {es ? 'Limpiar selección' : 'Clear selection'}
                    </button>
                  </div>
                )}
                <div className="max-h-52 overflow-y-auto">
                  {filteredUserNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => toggleUser(name)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/[0.03] transition-colors ${
                        selectedUsers.has(name) ? 'text-accent' : 'text-slate-400'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                        selectedUsers.has(name) ? 'bg-accent border-accent' : 'border-line'
                      }`}>
                        {selectedUsers.has(name) && <span className="text-white text-[8px] font-bold">✓</span>}
                      </span>
                      {normalizeName(name)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={exportSimCSV}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-line/50 hover:border-line rounded-lg px-2 sm:px-3 py-1.5 transition-all"
            title="Simulator CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{es ? 'Sim. CSV' : 'Sim. CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label={t('kpi_total_sims')}         value={activeKpis!.totalSimulations}            sub={t('sub_across_activities')} color="accent"  spark={simsSparkData}  />
        <KpiCard label={t('kpi_avg_score')}          value={avgDisplay}                              sub={t('sub_overall')}           color="violet"  spark={scoreSparkData} />
        <KpiCard label={t('kpi_active_advisors')}    value={activeKpis!.activeAdvisors}              sub={t('sub_with_simulations')}  color="indigo"  spark={advisorsSparkData} />
        <KpiCard label={t('kpi_cert_pct')}           value={certPct !== null ? `${certPct}%` : '…'} sub={t('sub_cert_pct')}          color="pass"    />
        <KpiCard label={t('kpi_total_activities')}   value={CERT_TOTAL_SLOTS}                        sub={t('sub_cert_slots')}        color="accent"  />
        <KpiCard label={t('kpi_total_members')}      value={kpis?.totalMembers ?? '…'}               sub={t('sub_registered')}        color="violet"  />
      </div>

      {/* Charts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">{t('score_trend')}</h3>
          {anyFilterActive && (
            <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {filteredSims.length} {es ? 'sims filtradas' : 'filtered sims'}
            </span>
          )}
        </div>
        <div className="h-48 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLORS.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
              <YAxis domain={[0, 100]} />
              <Tooltip content={<TrendTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ stroke: c.cursorStroke, strokeWidth: 1.5 }} />
              <Area type="monotone" dataKey="avgScore" stroke={COLORS.accent} strokeWidth={2} fill="url(#scoreGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Below-fold row: Activity breakdown + Top performers ─────────────── */}
      {/* Sentinel div — the IntersectionObserver watches this element.         */}
      {/* Once it enters the viewport the charts mount; until then only a       */}
      {/* lightweight placeholder occupies the layout so there is no CLS.       */}
      <div ref={belowFoldRef}>
        {belowFoldVisible ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Activity breakdown — needs actStats (sims + activities) */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">{t('activity_breakdown')}</h3>
              {activitiesLoading ? (
                <div className="h-48 sm:h-64 skeleton rounded-lg" />
              ) : (
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topActivities} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 'dataMax + 5']} hide />
                      <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                      <Tooltip content={<ActivityTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ fill: c.cursorFill }} />
                      <Bar dataKey="count" fill={COLORS.accent} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top performers — needs userStats (sims only, fast) */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-200">{t('top_performers')}</h3>
                <Link to="/leaderboard" className="text-xs text-accent hover:underline">{t('view_all')}</Link>
              </div>
              <div className="space-y-2">
                {(activeUserStats ?? []).slice(0, 5).map((u, i) => (
                  <div key={u.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      i === 0 ? 'bg-yellow-500/15 text-yellow-500' :
                      i === 1 ? 'bg-slate-400/15 text-slate-300' :
                      i === 2 ? 'bg-orange-500/15 text-orange-400' :
                      'bg-surface text-slate-600'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{u.name}</p>
                      <p className="text-[11px] text-slate-600">{u.count} {es ? (u.count === 1 ? 'simulación' : 'simulaciones') : (u.count === 1 ? 'simulation' : 'simulations')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-100">{u.avgScore}%</p>
                      <p className="text-[11px] text-slate-500">{t('col_best')}: {u.bestScore}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Placeholder — preserves layout height to avoid CLS when charts mount */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5 h-80 skeleton rounded-xl" />
            <div className="card p-5 h-80 skeleton rounded-xl" />
          </div>
        )}
      </div>

      {/* ── Score distribution — furthest below fold ──────────────────────────── */}
      <div ref={scoreSentRef}>
        {scoreVisible ? (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">{t('score_distribution')}</h3>
            <div className="h-44 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeScoreDist ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip content={<ScoreDistTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ fill: c.cursorFill }} />
                  <Bar dataKey="count" fill={COLORS.accent} radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="card p-5 h-72 skeleton rounded-xl" />
        )}
      </div>
    </div>
  )
}

const KpiCard = memo(function KpiCard({
  label, value, sub, color, spark,
}: {
  label: string; value: string | number; sub: string
  color: 'accent' | 'violet' | 'pass' | 'indigo'
  spark?: number[]
}) {
  const theme = useAppStore((s) => s.theme)
  const isDark = theme === 'dark'

  const palette = isDark ? {
    accent: { text: '#00D4FF', border: 'rgba(0,212,255,0.25)',   top: '#00D4FF', glow: 'rgba(0,212,255,0.06)',   fill: 'rgba(0,212,255,0.15)'   },
    violet: { text: '#A855F7', border: 'rgba(168,85,247,0.25)',  top: '#A855F7', glow: 'rgba(168,85,247,0.06)',  fill: 'rgba(168,85,247,0.15)'  },
    pass:   { text: '#10F5A0', border: 'rgba(16,245,160,0.25)',  top: '#10F5A0', glow: 'rgba(16,245,160,0.06)',  fill: 'rgba(16,245,160,0.15)'  },
    indigo: { text: '#818CF8', border: 'rgba(129,140,248,0.25)', top: '#818CF8', glow: 'rgba(129,140,248,0.06)', fill: 'rgba(129,140,248,0.15)' },
  } : {
    accent: { text: '#0284c7', border: 'rgba(2,132,199,0.3)',    top: '#0284c7', glow: 'rgba(2,132,199,0.07)',   fill: 'rgba(2,132,199,0.12)'   },
    violet: { text: '#7c3aed', border: 'rgba(124,58,237,0.3)',   top: '#7c3aed', glow: 'rgba(124,58,237,0.07)',  fill: 'rgba(124,58,237,0.12)'  },
    pass:   { text: '#059669', border: 'rgba(5,150,105,0.3)',    top: '#059669', glow: 'rgba(5,150,105,0.07)',   fill: 'rgba(5,150,105,0.12)'   },
    indigo: { text: '#4f46e5', border: 'rgba(79,70,229,0.3)',    top: '#4f46e5', glow: 'rgba(79,70,229,0.07)',   fill: 'rgba(79,70,229,0.12)'   },
  }
  const p = palette[color]
  // stable gradient ID — label chars are unique per card
  const gradId = `kpi-grad-${color}-${label.replace(/\s/g, '')}`

  const delta = (() => {
    if (!spark || spark.length < 4) return null
    const half = Math.floor(spark.length / 2)
    const first = spark.slice(0, half).reduce((a, b) => a + b, 0) / half
    const last  = spark.slice(-half).reduce((a, b) => a + b, 0) / half
    if (first === 0) return null
    const pct = Math.round(((last - first) / first) * 100)
    return pct === 0 ? null : pct
  })()

  return (
    <div
      className="card p-4 sm:p-5 relative overflow-hidden flex flex-col min-h-[160px]"
      style={{ borderColor: p.border, background: `linear-gradient(135deg, ${p.glow} 0%, transparent 60%)` }}
    >
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: p.top }} />

      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{label}</p>

      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums leading-none" style={{ color: p.text }}>
          {value}
        </p>
        {delta !== null && (
          <span className={`text-xs font-bold mb-0.5 shrink-0 ${delta > 0 ? 'text-success' : 'text-danger'}`}>
            {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-600 truncate mt-1 mb-auto">{sub}</p>

      {/* Sparkline slot — always same height to keep all cards equal */}
      <div className="h-12 mt-3 -mx-2 -mb-1">
        {spark && spark.length > 2 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ v, i }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={p.top} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={p.top} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={p.top} strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
})
