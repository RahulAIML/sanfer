import { useMemo } from 'react'
import { useSimulations, useOrgCertification, useCertStats } from '../api/queries'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { filterTestUsers, normalizeName } from '../lib/analytics'
import { CERT_LINES, CERT_WINDOW, CERT_TOTAL_SLOTS, CERT_JEFES, CERT_MIN_SIMS } from '../lib/certification'
import { cn } from '../lib/cn'
import {
  BadgeCheck, CalendarRange, GitBranch, Layers, PlayCircle, Users, Award,
} from 'lucide-react'

interface CertifiedAdvisor {
  email: string
  name: string
  scores: number[]
}

interface LineProgress {
  tagId: number
  name: string
  jefe: string
  memberCount: number
  expected: number
  completed: number
  passed: number
  sessions: number
  certified: CertifiedAdvisor[]
  simStats: { product: string; saexId: number; sessions: number; passed: number }[]
}

export default function CertificationPage() {
  const language = useAppStore((s) => s.language)
  const t  = useTranslation(language)
  const es = language === 'es'

  // Simulation data — still needed for raw session counts and per-sim stats
  const simsQ    = useSimulations(CERT_WINDOW.from, CERT_WINDOW.to)
  // Official per-user cert data from profiles_assigned — single source of truth
  const certDataQ = useOrgCertification()
  const certStatsQ = useCertStats()

  const isLoading = certDataQ.isLoading || simsQ.isLoading
  const sims = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])

  const lines: LineProgress[] = useMemo(() => {
    const certRows = certDataQ.data?.data ?? []

    // Group official cert rows by profile_id (= line tagId in rolePlay_sanfer_v3)
    const byLine = new Map<number, typeof certRows>()
    for (const row of certRows) {
      if (!byLine.has(row.profile_id)) byLine.set(row.profile_id, [])
      byLine.get(row.profile_id)!.push(row)
    }

    // Session stats from sim data — supplementary (raw counts, per-sim pass rates)
    const simSessionCount = new Map<number, number>()
    const simPassedUsers  = new Map<number, Set<string>>()
    for (const s of sims) {
      const id = s.ID_Caso_de_Uso
      simSessionCount.set(id, (simSessionCount.get(id) ?? 0) + 1)
      if (s.Diagnostico_Final?.toLowerCase() === 'si') {
        if (!simPassedUsers.has(id)) simPassedUsers.set(id, new Set())
        simPassedUsers.get(id)!.add((s.Usuario ?? '').toLowerCase())
      }
    }

    return CERT_LINES.map((line) => {
      const lineRows    = byLine.get(line.tagId) ?? []
      const memberCount = lineRows.length
      const expected    = memberCount * CERT_MIN_SIMS
      const completed   = lineRows.reduce((a, r) => a + (r.fase1 ?? 0) + (r.fase2 ?? 0) + (r.fase3 ?? 0), 0)
      const passed      = completed  // fase=1 means completed+passed in official DB
      const sessions    = line.sims.reduce((a, s) => a + (simSessionCount.get(s.saexId) ?? 0), 0)

      const certified: CertifiedAdvisor[] = lineRows
        .filter((r) => r.finalized === 1)
        .map((r) => ({
          email:  r.mb_user,
          name:   normalizeName(r.nombre ?? r.mb_user),
          scores: [r.fase1_score ?? 0, r.fase2_score ?? 0, r.fase3_score ?? 0],
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const simStats = line.sims.map((s) => ({
        product:  s.product,
        saexId:   s.saexId,
        sessions: simSessionCount.get(s.saexId) ?? 0,
        passed:   simPassedUsers.get(s.saexId)?.size ?? 0,
      }))

      return { tagId: line.tagId, name: line.name, jefe: line.jefe, memberCount, expected, completed, passed, sessions, certified, simStats }
    })
  }, [certDataQ.data, sims])

  // Certified count from official DB (rolePlay_sanfer_v3) — exact source of truth.
  // Falls back to client-side count while the DB query is in-flight.
  const globalCertified = certStatsQ.data?.certified
    ?? lines.reduce((acc, l) => acc + l.certified.length, 0)

  // Global progress — DB-sourced from cert.stats (bridge queries org DB + sim DB server-side).
  // Falls back to client-side totals while the DB query is in-flight.
  const dbStats = certStatsQ.data
  const totals = useMemo(() => {
    const passed    = lines.reduce((a, l) => a + l.passed, 0)
    const completed = dbStats?.completed ?? lines.reduce((a, l) => a + l.completed, 0)
    const expected  = dbStats?.expected  ?? lines.reduce((a, l) => a + l.expected, 0)
    return {
      expected,
      completed,
      passed,
      sessions: sims.length,
      pct:     expected ? Math.round((completed / expected) * 100) : 0,
      passPct: completed ? Math.round((passed / completed) * 100) : 0,
    }
  }, [lines, sims, dbStats])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 skeleton rounded-lg" />
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card p-5 h-24 skeleton rounded-xl" />)}
        </div>
        <div className="card p-5 h-96 skeleton rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {(() => {
        const isClosed   = false  // no end-date cap — window stays open
        const fmt = (iso: string) => {
          const d = new Date(iso + 'T12:00:00')
          return es
            ? `${d.getDate()} ${d.toLocaleString('es-MX', { month: 'short' })} ${d.getFullYear()}`
            : `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`
        }
        const rangeLabel = `${fmt(CERT_WINDOW.from)} – ${es ? 'presente' : 'present'}`
        return (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight flex items-center gap-2">
                <BadgeCheck className="w-6 h-6 text-accent" />
                {t('cert_title')}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">{t('cert_subtitle')} — {rangeLabel}</p>
            </div>
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              isClosed
                ? 'text-slate-400 bg-slate-700/30 border-slate-600/40'
                : 'text-accent bg-accent/10 border-accent/20'
            }`}>
              <CalendarRange className="w-3.5 h-3.5" />
              {isClosed ? t('cert_window_badge_closed') : t('cert_window_badge_active')} · {rangeLabel}
            </span>
          </div>
        )
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <CertKpi icon={GitBranch}    label={t('cert_kpi_lines')}     value={CERT_LINES.length} />
        <CertKpi icon={Layers}       label={t('cert_kpi_exercises')} value={CERT_TOTAL_SLOTS} />
        <CertKpi icon={Users}        label={t('cert_kpi_jefes')}     value={CERT_JEFES.length} />
        <CertKpi icon={PlayCircle}   label={t('cert_kpi_sessions')}  value={totals.sessions} />
        <CertKpi icon={Award}        label={t('cert_kpi_certified')} value={globalCertified} highlight />
      </div>

      {/* Global progress */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h3 className="text-sm font-semibold text-slate-200">{t('cert_progress')}</h3>
          <span className="text-xs text-slate-500">
            {totals.completed} / {totals.expected} · <span className="text-accent font-semibold">{totals.pct}%</span> {t('cert_completed')}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-surface overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${totals.pct}%` }} />
        </div>
        <p className="text-[11px] text-slate-600 mt-2">{t('cert_legend')}</p>
      </div>

      {/* Certified advisors — count + names grouped by line */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Award className="w-4 h-4 text-success" />
            {t('cert_certified_title')}
            <span className="text-success font-bold tabular-nums">{globalCertified}</span>
          </h3>
        </div>
        <p className="text-[11px] text-slate-600 mb-4">{t('cert_certified_def')}</p>
        {globalCertified === 0 ? (
          <p className="text-sm text-slate-500">{t('cert_certified_none')}</p>
        ) : (
          <div className="space-y-4">
            {lines.filter((l) => l.certified.length > 0).map((line) => (
              <div key={line.tagId}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">{line.name}</span>
                  <span className="text-[10px] text-slate-600">({line.jefe})</span>
                  <span className="text-[10px] font-bold text-success tabular-nums">{line.certified.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {line.certified.map((c) => (
                    <span
                      key={c.email}
                      className="inline-flex items-center gap-1.5 text-xs bg-success/5 border border-success/20 text-slate-300 rounded-full pl-2.5 pr-1 py-0.5"
                    >
                      {c.name}
                      <span className="text-[10px] font-bold text-success bg-success/10 rounded-full px-1.5 py-0.5 tabular-nums">
                        {c.scores.join(' · ')}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment matrix grouped by jefe */}
      {CERT_JEFES.map((jefe) => (
        <div key={jefe} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            {es ? 'Jefe de Capacitación' : 'Training Chief'}: <span className="text-slate-300">{jefe}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lines.filter((l) => l.jefe === jefe).map((line) => {
              const pct = line.expected ? Math.round((line.completed / line.expected) * 100) : 0
              return (
                <div key={line.tagId} className="card p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-slate-100 capitalize truncate">{line.name}</span>
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {line.memberCount} {t('cert_col_members').toLowerCase()}
                      </span>
                      {line.certified.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-success shrink-0" title={t('cert_kpi_certified')}>
                          <Award className="w-3 h-3" />{line.certified.length}
                          {line.certified.length > line.memberCount && (
                            <span className="text-amber-500 font-normal ml-0.5" title={es ? 'Certificados fuera del padrón actual' : 'Certified but not in current roster'}>
                              (+{line.certified.length - line.memberCount})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-bold shrink-0 tabular-nums',
                      pct >= 100 ? 'text-success' : pct > 0 ? 'text-accent' : 'text-slate-600',
                    )}>{pct}%</span>
                  </div>

                  <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-3">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', pct >= 100 ? 'bg-success' : 'bg-accent')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    {line.simStats.map((sim) => (
                      <div key={`${sim.saexId}-${sim.product}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-400 min-w-0">
                          <span className="truncate">{sim.product}</span>
                          <span className="text-slate-700 shrink-0">#{sim.saexId}</span>
                        </span>
                        <span className="text-slate-600 shrink-0 tabular-nums">
                          {sim.sessions} {t('cert_sessions')}
                          {sim.passed > 0 && <span className="text-success"> · {sim.passed} ✓</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function CertKpi({ icon: Icon, label, value, highlight = false }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className={highlight ? 'card p-4 border border-success/30' : 'card p-4'}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${highlight ? 'bg-success/10' : 'bg-accent/10'}`}>
          <Icon className={`w-4 h-4 ${highlight ? 'text-success' : 'text-accent'}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-lg font-bold leading-tight tabular-nums ${highlight ? 'text-success' : 'text-slate-100'}`}>{value}</p>
          <p className="text-[11px] text-slate-500 truncate">{label}</p>
        </div>
      </div>
    </div>
  )
}
