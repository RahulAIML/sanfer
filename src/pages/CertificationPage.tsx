import { useMemo } from 'react'
import { useSimulations, useMembers } from '../api/queries'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { filterTestUsers } from '../lib/analytics'
import { CERT_LINES, CERT_WINDOW, CERT_TOTAL_SLOTS, CERT_JEFES } from '../lib/certification'
import { cn } from '../lib/cn'
import {
  BadgeCheck, CalendarRange, GitBranch, Layers, PlayCircle, Users, CheckCircle2,
} from 'lucide-react'

interface LineProgress {
  tagId: number
  name: string
  jefe: string
  memberCount: number
  expected: number       // members × 3 assigned sims
  completed: number      // distinct (advisor, assigned sim) pairs with a session
  passed: number         // of those, pairs whose best session passed
  sessions: number       // raw session count on the line's sims (line members only)
  simStats: { product: string; saexId: number; sessions: number; passed: number }[]
}

export default function CertificationPage() {
  const language = useAppStore((s) => s.language)
  const t  = useTranslation(language)
  const es = language === 'es'

  // Fixed certification window — independent of the global dashboard filter
  const simsQ    = useSimulations(CERT_WINDOW.from, CERT_WINDOW.to)
  const membersQ = useMembers()

  const isLoading = simsQ.isLoading || membersQ.isLoading
  const sims      = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])
  const members   = membersQ.data ?? []

  const lines: LineProgress[] = useMemo(() => {
    // line tagId → active member emails (lowercased) — excludes internal accounts
    const membersByLine = new Map<number, Set<string>>()
    for (const m of members) {
      if (m.mb_status !== 1 || !m.mb_idTag1 || !m.mb_user) continue
      const email = m.mb_user.toLowerCase()
      if (email.includes('rolplay')) continue
      if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, new Set())
      membersByLine.get(m.mb_idTag1)!.add(email)
    }

    // (email|simId) → best outcome within the window
    const pairPassed = new Map<string, boolean>()
    const simsById   = new Map<number, { sessions: number; passedUsers: Set<string> }>()
    for (const s of sims) {
      const email = (s.Usuario ?? '').toLowerCase()
      if (!email) continue
      const key  = `${email}|${s.ID_Caso_de_Uso}`
      const pass = s.Diagnostico_Final?.toLowerCase() === 'si'
      pairPassed.set(key, (pairPassed.get(key) ?? false) || pass)
      if (!simsById.has(s.ID_Caso_de_Uso)) simsById.set(s.ID_Caso_de_Uso, { sessions: 0, passedUsers: new Set() })
      const agg = simsById.get(s.ID_Caso_de_Uso)!
      agg.sessions++
      if (pass) agg.passedUsers.add(email)
    }

    return CERT_LINES.map((line) => {
      const lineMembers = membersByLine.get(line.tagId) ?? new Set<string>()
      let completed = 0
      let passed    = 0
      let sessions  = 0
      for (const email of lineMembers) {
        for (const sim of line.sims) {
          const v = pairPassed.get(`${email}|${sim.saexId}`)
          if (v !== undefined) { completed++; if (v) passed++ }
        }
      }
      for (const s of sims) {
        const email = (s.Usuario ?? '').toLowerCase()
        if (lineMembers.has(email) && line.sims.some((x) => x.saexId === s.ID_Caso_de_Uso)) sessions++
      }
      return {
        tagId:       line.tagId,
        name:        line.name,
        jefe:        line.jefe,
        memberCount: lineMembers.size,
        expected:    lineMembers.size * 3,
        completed,
        passed,
        sessions,
        simStats: line.sims.map((sim) => ({
          product:  sim.product,
          saexId:   sim.saexId,
          sessions: simsById.get(sim.saexId)?.sessions ?? 0,
          passed:   simsById.get(sim.saexId)?.passedUsers.size ?? 0,
        })),
      }
    })
  }, [sims, members])

  const totals = useMemo(() => {
    const expected  = lines.reduce((a, l) => a + l.expected, 0)
    const completed = lines.reduce((a, l) => a + l.completed, 0)
    const passed    = lines.reduce((a, l) => a + l.passed, 0)
    return {
      expected,
      completed,
      passed,
      sessions: sims.length,
      pct:      expected ? Math.round((completed / expected) * 100) : 0,
      passPct:  completed ? Math.round((passed / completed) * 100) : 0,
    }
  }, [lines, sims])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 skeleton rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card p-5 h-24 skeleton rounded-xl" />)}
        </div>
        <div className="card p-5 h-96 skeleton rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight flex items-center gap-2">
            <BadgeCheck className="w-6 h-6 text-accent" />
            {t('cert_title')}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('cert_subtitle')}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-full">
          <CalendarRange className="w-3.5 h-3.5" />
          {t('cert_window_badge')}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <CertKpi icon={GitBranch}    label={t('cert_kpi_lines')}     value={CERT_LINES.length} />
        <CertKpi icon={Layers}       label={t('cert_kpi_exercises')} value={CERT_TOTAL_SLOTS} />
        <CertKpi icon={Users}        label={t('cert_kpi_jefes')}     value={CERT_JEFES.length} />
        <CertKpi icon={PlayCircle}   label={t('cert_kpi_sessions')}  value={totals.sessions} />
        <CertKpi icon={CheckCircle2} label={t('cert_kpi_passrate')}  value={`${totals.passPct}%`} />
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

function CertKpi({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-100 leading-tight tabular-nums">{value}</p>
          <p className="text-[11px] text-slate-500 truncate">{label}</p>
        </div>
      </div>
    </div>
  )
}
