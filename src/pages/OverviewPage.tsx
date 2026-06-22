import { memo, useState, useMemo, useRef, useEffect } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import {
  computeKPIs, computeActivityStats, computeUserStats, computeScoreDistribution, normalizeName,
} from '../lib/analytics'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { CERT_TOTAL_SLOTS } from '../lib/certification'
import { useTopStats, useCertCount } from '../api/queries'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { downloadCSV, csvDate } from '../lib/csvExport'
import { matchesSearch } from '../lib/searchUtils'
import {
  Users, Download, Search, ChevronDown, X,
  PlayCircle, TrendingUp, UserCheck, BadgeCheck, Layers,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'
import { cn } from '../lib/cn'

const COLORS = { pass: '#10B981', fail: '#EF4444', accent: '#DC2626', violet: '#A855F7' }

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

function computeDelta(spark: number[]): number | null {
  if (spark.length < 4) return null
  const half  = Math.floor(spark.length / 2)
  const first = spark.slice(0, half).reduce((a, b) => a + b, 0) / half
  const last  = spark.slice(-half).reduce((a, b) => a + b, 0) / half
  if (first === 0) return null
  const pct = Math.round(((last - first) / first) * 100)
  return pct === 0 ? null : pct
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

  // Pass/Fail donut data
  const passCount = useMemo(
    () => filteredSims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length,
    [filteredSims],
  )
  const failCount  = filteredSims.length - passCount
  const passRatePct = filteredSims.length > 0 ? Math.round(passCount / filteredSims.length * 100) : 0
  const donutData  = useMemo(() => [
    { name: es ? 'Aprobadas' : 'Passed', value: passCount,  fill: COLORS.pass },
    { name: es ? 'Reprobadas' : 'Failed', value: failCount, fill: COLORS.fail },
  ], [passCount, failCount, es])

  // Deltas from sparkline trends
  const simsDelta     = useMemo(() => computeDelta(simsSparkData),     [simsSparkData])
  const scoreDelta    = useMemo(() => computeDelta(scoreSparkData),     [scoreSparkData])
  const advisorsDelta = useMemo(() => computeDelta(advisorsSparkData),  [advisorsSparkData])

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

  const _actItems  = (activeActStats ?? []).slice(0, 6)
  const _maxCount  = _actItems[0]?.count ?? 1
  const _total     = filteredSims.length || 1
  const topActivities = _actItems.map((a) => ({
    name:     a.name.length > 32 ? a.name.slice(0, 32) + '…' : a.name,
    count:    a.count,
    barWidth: Math.round((a.count / _maxCount) * 100),
    pct:      Math.round((a.count / _total) * 100),
  }))

  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <div className="rounded-2xl px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, #DC2626 0%, #991b1b 100%)' }}>
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">
          {es ? 'Bienvenido al dashboard' : 'Welcome to the dashboard'}
        </h1>
        <p className="text-white/75 text-sm mt-1">
          {activeKpis
            ? (es
                ? `${activeKpis.totalSimulations} simulaciones en el período seleccionado · ${activeKpis.activeAdvisors} asesores activos`
                : `${activeKpis.totalSimulations} simulations in the selected period · ${activeKpis.activeAdvisors} active advisors`)
            : (es ? 'Cargando datos…' : 'Loading data…')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            from={from} to={to}
            onApply={(f, tDate) => setDateRange(f || null, tDate || null)}
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
              <div className="absolute top-full mt-1 left-0 z-30 w-56 sm:w-64 bg-surface border border-line rounded-xl shadow-elevated overflow-hidden">
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label={t('kpi_total_sims')}       value={activeKpis!.totalSimulations}            sub={t('sub_across_activities')} icon={PlayCircle}  iconBg="bg-blue-100 dark:bg-blue-900/20"   iconColor="text-blue-600 dark:text-blue-400"   delta={simsDelta} es={es} />
        <KpiCard label={t('kpi_avg_score')}        value={avgDisplay}                              sub={t('sub_overall')}           icon={TrendingUp}  iconBg="bg-green-100 dark:bg-green-900/20" iconColor="text-green-600 dark:text-green-400" delta={scoreDelta} es={es} />
        <KpiCard label={t('kpi_active_advisors')}  value={activeKpis!.activeAdvisors}              sub={t('sub_with_simulations')}  icon={UserCheck}   iconBg="bg-purple-100 dark:bg-purple-900/20" iconColor="text-purple-600 dark:text-purple-400" delta={advisorsDelta} es={es} />
        <KpiCard label={t('kpi_cert_pct')}         value={certPct !== null ? `${certPct}%` : '…'} sub={t('sub_cert_pct')}          icon={BadgeCheck}  iconBg="bg-red-100 dark:bg-red-900/20"     iconColor="text-red-600 dark:text-red-400"     />
        <KpiCard label={t('kpi_total_activities')} value={CERT_TOTAL_SLOTS}                        sub={t('sub_cert_slots')}        icon={Layers}      iconBg="bg-orange-100 dark:bg-orange-900/20" iconColor="text-orange-600 dark:text-orange-400" />
        <KpiCard label={t('kpi_total_members')}    value={kpis?.totalMembers ?? '…'}               sub={t('sub_registered')}        icon={Users}       iconBg="bg-slate-100 dark:bg-slate-800"    iconColor="text-slate-600 dark:text-slate-400" />
      </div>

      {/* Score Trend + Pass/Fail Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">{t('score_trend')}</h3>
            {anyFilterActive && (
              <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {filteredSims.length} {es ? 'sims filtradas' : 'filtered sims'}
              </span>
            )}
          </div>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.accent} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<TrendTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ stroke: c.cursorStroke, strokeWidth: 1.5 }} />
                <ReferenceLine y={75} stroke="#DC2626" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: es ? 'Meta 75%' : 'Goal 75%', position: 'insideTopRight', fontSize: 9, fill: '#DC2626', opacity: 0.8 }} />
                <Area type="monotone" dataKey="avgScore" stroke={COLORS.accent} strokeWidth={2} fill="url(#scoreGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pass / Fail donut */}
        <div className="card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            {es ? 'Aprobadas / Reprobadas' : 'Passed / Failed'}
          </h3>
          <div className="flex-1 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={72}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                  strokeWidth={0}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{passRatePct}%</p>
              <p className="text-[11px] text-slate-500">{es ? 'Aprob.' : 'Pass rate'}</p>
            </div>
          </div>
          <div className="flex justify-center gap-5 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS.pass }} />
              <span className="text-xs text-slate-500">{es ? 'Aprobadas' : 'Passed'}</span>
              <span className="text-xs font-semibold text-slate-300 tabular-nums">{passCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS.fail }} />
              <span className="text-xs text-slate-500">{es ? 'Reprobadas' : 'Failed'}</span>
              <span className="text-xs font-semibold text-slate-300 tabular-nums">{failCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity breakdown + Top Advisors */}
      <div ref={belowFoldRef}>
        {belowFoldVisible ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Activity horizontal progress bars */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">{t('activity_breakdown')}</h3>
              {activitiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 skeleton rounded-lg" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {topActivities.map((a) => (
                    <div key={a.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-400 truncate mr-2">{a.name}</span>
                        <span className="text-xs font-semibold text-slate-300 tabular-nums shrink-0">{a.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-700"
                          style={{ width: `${a.barWidth}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top advisors with medals */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-200">{t('top_performers')}</h3>
                <Link to="/leaderboard" className="text-xs text-accent hover:underline">{t('view_all')}</Link>
              </div>
              <div className="space-y-1">
                {(activeUserStats ?? []).slice(0, 5).map((u, i) => {
                  const parts    = u.name.split(' ').filter(Boolean)
                  const initials = parts.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
                  return (
                    <div key={u.name} className="flex items-center gap-3 py-2 border-b border-line/20 last:border-0">
                      <span className="text-base shrink-0 w-5 text-center leading-none">
                        {i < 3 ? MEDALS[i] : <span className="text-xs text-slate-500 font-bold">{i + 1}</span>}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-accent">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-200 truncate">{u.name}</p>
                        <p className="text-[11px] text-slate-500">{u.count} {es ? 'sim.' : 'sim.'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-accent tabular-nums">{u.bestScore}%</p>
                        <p className="text-[10px] text-slate-600">{t('col_best')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5 h-72 skeleton rounded-xl" />
            <div className="card p-5 h-72 skeleton rounded-xl" />
          </div>
        )}
      </div>

      {/* Score distribution */}
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
  label, value, sub, icon: Icon, iconBg, iconColor, delta, es,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  delta?: number | null
  es?: boolean
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3 gap-2">
        <p className="text-xs text-slate-500 font-medium leading-tight">{label}</p>
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight leading-none">
        {value}
      </p>
      <p className="text-[11px] text-slate-500 mt-1.5 truncate">{sub}</p>
      {delta != null && (
        <p className={cn('text-[11px] font-semibold mt-2 flex items-center gap-0.5', delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
          <span>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%</span>
          <span className="text-slate-500 font-normal">{es ? ' vs mes anterior' : ' vs prev. period'}</span>
        </p>
      )}
    </div>
  )
})
