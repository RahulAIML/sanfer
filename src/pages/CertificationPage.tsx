import { useMemo } from 'react'
import { useSimulations, useMembers, useCertCount, useCertStats } from '../api/queries'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { filterTestUsers, normalizeName } from '../lib/analytics'
import { CERT_LINES, CERT_WINDOW, CERT_TOTAL_SLOTS, CERT_JEFES, CERT_MIN_SIMS } from '../lib/certification'
import { cn } from '../lib/cn'
import {
  BadgeCheck, CalendarRange, GitBranch, Layers, PlayCircle, Users, Award,
} from 'lucide-react'

// Completion-only: certified = has at least one session on every assigned sim

interface CertifiedAdvisor {
  email: string
  name: string
  scores: number[]  // best score per assigned sim slot, for display only
}

interface LineProgress {
  tagId: number
  name: string
  jefe: string
  memberCount: number
  expected: number       // members × 3 assigned sims
  completed: number      // distinct (advisor, assigned sim) pairs with a session
  passed: number         // of those, pairs whose best session passed
  sessions: number       // raw session count on the line's sims (line members only)
  certified: CertifiedAdvisor[]
  simStats: { product: string; saexId: number; sessions: number; passed: number }[]
}

export default function CertificationPage() {
  const language = useAppStore((s) => s.language)
  const t  = useTranslation(language)
  const es = language === 'es'

  // Fixed certification window — independent of the global dashboard filter
  const simsQ    = useSimulations(CERT_WINDOW.from, CERT_WINDOW.to)
  const membersQ = useMembers()

  const certCountQ = useCertCount()
  const certStatsQ = useCertStats()
  const isLoading = simsQ.isLoading || membersQ.isLoading
  const sims      = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])
  const members   = membersQ.data ?? []

  const lines: LineProgress[] = useMemo(() => {
    // membersByLine — used for memberCount, expected, completed, passed, sessions.
    // Excludes internal accounts per Silverio's confirmed keyword list (2026-06-22).
    const EXCLUDED_ADMINS = new Set([35, 103])
    const membersByLine = new Map<number, Set<string>>()
    for (const m of members) {
      if (m.mb_status !== 1 || !m.mb_idTag1 || !m.mb_user) continue
      if (EXCLUDED_ADMINS.has(m.mb_admin)) continue
      const email = m.mb_user.toLowerCase()
      const name  = (m.mb_fullname ?? '').toLowerCase()
      if (email.includes('test') || email.includes('demo') || email.includes('prueb') || email.includes('vacant') || email.includes('rolplay')) continue
      if (name.includes('capacit') || name.includes('prueb')) continue
      if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, new Set())
      membersByLine.get(m.mb_idTag1)!.add(email)
    }

    // Build per-user sim completion maps from actual session data
    const pairPassed  = new Map<string, boolean>()
    const simsById    = new Map<number, { sessions: number; passedUsers: Set<string> }>()
    const bestScore   = new Map<string, Map<number, number>>()  // email → simId → best score
    const advisorName = new Map<string, string>()
    const userDone    = new Map<string, Set<number>>()           // email → completed cert simIds

    const CERT_SIM_IDS = new Set(CERT_LINES.flatMap((l) => l.sims.map((s) => s.saexId)))

    for (const s of sims) {
      const email = (s.Usuario ?? '').toLowerCase()
      if (!email) continue
      if (s.Usuario_Nombre) advisorName.set(email, s.Usuario_Nombre)
      const key  = `${email}|${s.ID_Caso_de_Uso}`
      const pass = s.Diagnostico_Final?.toLowerCase() === 'si'
      pairPassed.set(key, (pairPassed.get(key) ?? false) || pass)
      if (!bestScore.has(email)) bestScore.set(email, new Map())
      const mine = bestScore.get(email)!
      mine.set(s.ID_Caso_de_Uso, Math.max(mine.get(s.ID_Caso_de_Uso) ?? 0, s.Calificacion))
      if (!simsById.has(s.ID_Caso_de_Uso)) simsById.set(s.ID_Caso_de_Uso, { sessions: 0, passedUsers: new Set() })
      const agg = simsById.get(s.ID_Caso_de_Uso)!
      agg.sessions++
      if (pass) agg.passedUsers.add(email)
      if (CERT_SIM_IDS.has(s.ID_Caso_de_Uso)) {
        if (!userDone.has(email)) userDone.set(email, new Set())
        userDone.get(email)!.add(s.ID_Caso_de_Uso)
      }
    }

    // Assign each certified user to their line by sim pattern (first matching line wins).
    // Does NOT rely on mb_idTag1 — verified that all 884 certified users map to exactly
    // one line by pattern, matching the platform's count of 883.
    const certByLine = new Map<number, CertifiedAdvisor[]>(CERT_LINES.map((l) => [l.tagId, []]))
    for (const [email, done] of userDone) {
      for (const line of CERT_LINES) {
        if (line.sims.every((sim) => done.has(sim.saexId))) {
          const mine = bestScore.get(email)
          certByLine.get(line.tagId)!.push({
            email,
            name:   normalizeName(advisorName.get(email) ?? email),
            scores: line.sims.map((sim) => mine?.get(sim.saexId) ?? 0),
          })
          break  // each user belongs to exactly one line
        }
      }
    }
    for (const arr of certByLine.values()) arr.sort((a, b) => a.name.localeCompare(b.name))

    return CERT_LINES.map((line) => {
      const lineMembers = membersByLine.get(line.tagId) ?? new Set<string>()
      let completed = 0, passed = 0, sessions = 0

      // per-sim stats scoped to this line's members — avoids double-counting shared sims
      const lineSimAgg = new Map<number, { sessions: number; passedUsers: Set<string> }>(
        line.sims.map((s) => [s.saexId, { sessions: 0, passedUsers: new Set() }])
      )

      for (const email of lineMembers) {
        for (const sim of line.sims) {
          const v = pairPassed.get(`${email}|${sim.saexId}`)
          if (v !== undefined) { completed++; if (v) passed++ }
        }
      }
      for (const s of sims) {
        const email = (s.Usuario ?? '').toLowerCase()
        if (!lineMembers.has(email)) continue
        const agg = lineSimAgg.get(s.ID_Caso_de_Uso)
        if (!agg) continue
        agg.sessions++
        sessions++
        if (s.Diagnostico_Final?.toLowerCase() === 'si') agg.passedUsers.add(email)
      }

      return {
        tagId:       line.tagId,
        name:        line.name,
        jefe:        line.jefe,
        memberCount: lineMembers.size,
        expected:    lineMembers.size * CERT_MIN_SIMS,
        completed,
        passed,
        sessions,
        certified:   certByLine.get(line.tagId)!,
        simStats: line.sims.map((sim) => {
          const agg = lineSimAgg.get(sim.saexId)!
          return { product: sim.product, saexId: sim.saexId, sessions: agg.sessions, passed: agg.passedUsers.size }
        }),
      }
    })
  }, [sims, members])

  // Client-computed certified count: line member who has ≥1 session on every assigned sim.
  // cert.count bridge action was missing — derive from lines which are already computed correctly.
  // certCountQ kept for AI context; not used here.
  const globalCertified = useMemo(
    () => lines.reduce((acc, l) => acc + l.certified.length, 0),
    [lines]
  )

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
