import type { Activity, Administrator, LineTag, Member, Simulation } from '../api/types'
import { CERT_LINES, CERT_MIN_SIMS, CERT_OFFICIAL_TOTAL, CERT_WINDOW } from './certification'

// re-export so pages can import directly
export type { Simulation }

export const PASS_THRESHOLD = 70

/** Maximum data points returned from computeTrend — prevents chart overload */
const MAX_TREND_POINTS = 60

// ─────────────────────────────────────────────
// Test / demo user filtering
// Validated against live demorp6 data (2026-06): test accounts use
// rolplay.com / rolplay-sanfer.com / rolplaysanfer.com email domains and
// "Tester*" / "RolPlay Pruebas*" names. Real users are @sanfer.com.mx,
// @sanfer.com and @hormona.com.mx. The bridge also excludes rolplay
// domains server-side — this is a client-side backstop.
// ─────────────────────────────────────────────
const TEST_USER_BLOCKLIST = new Set([
  'Tester Sanfer Demo',
  'Tester Sanfer Grupal',
  'Tester Sanfer Completo',
  'Piloto 1', 'Piloto 2', 'Piloto 8',
  'Sanfer01', 'Demo User',
])

function isTestUser(s: Simulation): boolean {
  const name  = s.Usuario_Nombre ?? ''
  const email = (s.Usuario ?? '').toLowerCase()
  if (TEST_USER_BLOCKLIST.has(name)) return true
  if (email.includes('rolplay')) return true
  const nl = name.toLowerCase()
  return nl.startsWith('tester') || nl.startsWith('rolplay pruebas')
}

/** Remove simulations belonging to known test/demo accounts */
export function filterTestUsers(sims: Simulation[]): Simulation[] {
  return sims.filter((s) => !isTestUser(s))
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normalizes a display name: converts ALL-CAPS strings (e.g. "NANCY MARTINEZ")
 * to Title Case ("Nancy Martinez"). Mixed-case names are returned as-is.
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(\w)\w+/g, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
  }
  return trimmed
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

/** True only for numeric 0/1 interaction values — excludes "No aplica" and null */
function isApplicable(v: unknown): v is number {
  return typeof v === 'number'
}

const INTERACTION_KEYS = ['Puntos_1', 'Puntos_2', 'Puntos_3', 'Puntos_4', 'Puntos_5'] as const

// Calificacion is a 0-100 percentage; guard against null/non-numeric API values
function avgScore(sims: Simulation[]): number {
  const valid = sims.map((s) => Number(s.Calificacion)).filter((n) => Number.isFinite(n))
  if (!valid.length) return 0
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

/**
 * Downsamples an array to at most `maxPoints` entries by evenly skipping elements.
 * Preserves the first and last points for accurate axis bounds.
 */
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr
  const step = Math.ceil(arr.length / maxPoints)
  const result: T[] = []
  for (let i = 0; i < arr.length; i++) {
    if (i % step === 0 || i === arr.length - 1) result.push(arr[i])
  }
  return result
}

// ─────────────────────────────────────────────
// Quick KPIs — sims only, no org data needed
// Available the instant the simulations query resolves.
// Powers the 4 main OverviewPage KPI cards before org data arrives.
// ─────────────────────────────────────────────

export interface QuickKPIs {
  totalSimulations: number
  averageScore:     number
  passRate:         number
  activeAdvisors:   number
  passCount:        number
  failCount:        number
  bestScore:        number
  worstScore:       number
}

/** O(N) — derives the 4 primary KPIs from simulations only. No org data required. */
export function computeQuickKPIs(sims: Simulation[]): QuickKPIs {
  const passCount = sims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
  const advisors  = new Set(sims.map((s) => s.Usuario_Nombre).filter(Boolean))
  let bestScore  = 0
  let worstScore = 0
  if (sims.length) {
    bestScore  = sims.reduce((m, s) => Math.max(m, s.Calificacion), -Infinity)
    worstScore = sims.reduce((m, s) => Math.min(m, s.Calificacion),  Infinity)
    if (!Number.isFinite(bestScore))  bestScore  = 0
    if (!Number.isFinite(worstScore)) worstScore = 0
  }
  return {
    totalSimulations: sims.length,
    averageScore:     avgScore(sims),
    passRate:         pct(passCount, sims.length),
    activeAdvisors:   advisors.size,
    passCount,
    failCount:  sims.length - passCount,
    bestScore,
    worstScore,
  }
}

// ─────────────────────────────────────────────
// Core KPIs
// ─────────────────────────────────────────────

export interface DashboardKPIs {
  totalSimulations: number
  averageScore: number
  passRate: number
  activeAdvisors: number
  totalActivities: number
  totalMembers: number
  totalAdmins: number
  totalSupervisors: number
  bestScore: number
  worstScore: number
  passCount: number
  failCount: number
}

export function computeKPIs(
  sims: Simulation[],
  activities: Activity[],
  members: Member[],
  admins: Administrator[],
  rawMemberCount?: number,
): DashboardKPIs {
  const passCount = sims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
  const advisors  = new Set(sims.map((s) => s.Usuario_Nombre).filter(Boolean))

  // Use Math.max/min with reduce to avoid stack overflow on large arrays
  let bestScore  = 0
  let worstScore = 0
  if (sims.length) {
    bestScore  = sims.reduce((m, s) => Math.max(m, s.Calificacion), -Infinity)
    worstScore = sims.reduce((m, s) => Math.min(m, s.Calificacion),  Infinity)
    if (!Number.isFinite(bestScore))  bestScore  = 0
    if (!Number.isFinite(worstScore)) worstScore = 0
  }

  return {
    totalSimulations: sims.length,
    averageScore:     avgScore(sims),
    passRate:         pct(passCount, sims.length),
    activeAdvisors:   advisors.size,
    totalActivities:  activities.length,
    totalMembers:     rawMemberCount ?? members.length,
    totalAdmins:      admins.filter((a) => a.rpa_profile_type === 'admin').length,
    totalSupervisors: admins.filter((a) => a.rpa_profile_type === 'supervisor').length,
    bestScore,
    worstScore,
    passCount,
    failCount: sims.length - passCount,
  }
}

// ─────────────────────────────────────────────
// Score Distribution
// ─────────────────────────────────────────────

export interface ScoreBucket {
  label: string
  count: number
  min: number
  max: number
}

export function computeScoreDistribution(sims: Simulation[]): ScoreBucket[] {
  const buckets: ScoreBucket[] = [
    { label: '0–20',   min: 0,  max: 20,  count: 0 },
    { label: '21–40',  min: 21, max: 40,  count: 0 },
    { label: '41–60',  min: 41, max: 60,  count: 0 },
    { label: '61–80',  min: 61, max: 80,  count: 0 },
    { label: '81–100', min: 81, max: 100, count: 0 },
  ]
  sims.forEach((s) => {
    const b = buckets.find((bk) => s.Calificacion >= bk.min && s.Calificacion <= bk.max)
    if (b) b.count++
  })
  return buckets
}

// ─────────────────────────────────────────────
// Trend over time (downsampled to MAX_TREND_POINTS)
// ─────────────────────────────────────────────

export interface TrendPoint {
  date: string
  avgScore: number
  count: number
  passRate: number
}

export function computeTrend(sims: Simulation[]): TrendPoint[] {
  const byDate: Record<string, Simulation[]> = {}
  sims.forEach((s) => {
    const date = s.Fecha_y_Hora.substring(0, 10)
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(s)
  })

  const sorted = Object.entries(byDate)
    .map(([date, group]) => ({
      date,
      avgScore: Math.round(avg(group.map((s) => s.Calificacion))),
      count:    group.length,
      passRate: pct(
        group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length,
        group.length,
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Cap at MAX_TREND_POINTS so Recharts never renders more than 60 data points
  return downsample(sorted, MAX_TREND_POINTS)
}

// ─────────────────────────────────────────────
// Round-level averages (Puntos_1..5)
// ─────────────────────────────────────────────

export interface RoundStat {
  round: number
  label: string
  avg: number
  passRate: number
  count: number
}

export function computeRoundStats(sims: Simulation[]): RoundStat[] {
  return [1, 2, 3, 4, 5].map((i) => {
    const key    = `Puntos_${i}` as keyof Simulation
    const values = sims.map((s) => s[key]).filter(isApplicable)
    return {
      round:    i,
      label:    `I${i}`,
      avg:      values.length ? Math.round(avg(values) * 100) / 100 : 0,
      passRate: values.length ? pct(values.filter((v) => v > 0).length, values.length) : 0,
      count:    values.length,
    }
  }).filter((r) => r.count > 0)
}

// ─────────────────────────────────────────────
// Activity statistics
// ─────────────────────────────────────────────

export interface ActivityStat {
  id: number
  name: string
  activityType: string
  count: number
  avgScore: number
  passRate: number
  passCount: number
  failCount: number
}

export function computeActivityStats(
  sims: Simulation[],
  activities: Activity[],
): ActivityStat[] {
  const actMap = new Map(activities.map((a) => [a.ID_Caso_de_Uso, a]))
  const byActivity: Record<number, Simulation[]> = {}

  sims.forEach((s) => {
    if (!byActivity[s.ID_Caso_de_Uso]) byActivity[s.ID_Caso_de_Uso] = []
    byActivity[s.ID_Caso_de_Uso].push(s)
  })

  return Object.entries(byActivity).map(([id, group]) => {
    const numId     = Number(id)
    const act       = actMap.get(numId)
    const passCount = group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    return {
      id:           numId,
      name:         act?.Caso_de_Uso     ?? `Activity ${id}`,
      activityType: act?.Actividad_Nombre ?? 'unknown',
      count:        group.length,
      avgScore:     avgScore(group),
      passRate:     pct(passCount, group.length),
      passCount,
      failCount: group.length - passCount,
    }
  })
}

// ─────────────────────────────────────────────
// User (advisor) statistics — leaderboard
// ─────────────────────────────────────────────

export interface UserStat {
  name: string
  userId: string | null
  count: number
  avgScore: number
  passRate: number
  bestScore: number
  passCount: number
}

export function computeUserStats(sims: Simulation[]): UserStat[] {
  // Group by email (stable key) so the same person doesn't split across
  // different name formats (ALL-CAPS vs Title Case from the DB).
  const byEmail: Record<string, Simulation[]> = {}
  sims.forEach((s) => {
    const key = (s.Usuario || s.Usuario_Nombre || 'Unknown').toLowerCase()
    if (!byEmail[key]) byEmail[key] = []
    byEmail[key].push(s)
  })

  return Object.entries(byEmail)
    .map(([, group]) => {
      const passCount = group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
      const bestScore = group.reduce((m, s) => Math.max(m, s.Calificacion), 0)
      // Pick the best-formatted display name: prefer mixed-case over ALL-CAPS
      const rawName = group.find((s) => s.Usuario_Nombre && s.Usuario_Nombre !== s.Usuario_Nombre?.toUpperCase())?.Usuario_Nombre
        ?? group[0].Usuario_Nombre
        ?? group[0].Usuario
        ?? 'Unknown'
      return {
        name:      normalizeName(rawName),
        userId:    group[0].Usuario,
        count:     group.length,
        avgScore:  avgScore(group),
        passRate:  pct(passCount, group.length),
        bestScore,
        passCount,
      }
    })
    .sort((a, b) => b.avgScore - a.avgScore)
}

// ─────────────────────────────────────────────
// Organization hierarchy
// ─────────────────────────────────────────────

export interface OrgNode {
  id: number
  name: string
  email: string
  type: string
  parentId: number
  children: OrgNode[]
  memberCount: number
}

export function buildOrgTree(admins: Administrator[], members: Member[]): OrgNode[] {
  const adminMemberCount = new Map<number, number>()
  members.forEach((m) => {
    adminMemberCount.set(m.mb_admin, (adminMemberCount.get(m.mb_admin) ?? 0) + 1)
  })

  const nodes = new Map<number, OrgNode>(
    admins.map((a) => [
      a.rpa_id,
      {
        id:          a.rpa_id,
        name:        a.rpa_full_name,
        email:       a.rpa_email,
        type:        a.rpa_profile_type,
        parentId:    a.rpa_parent,
        children:    [],
        memberCount: adminMemberCount.get(a.rpa_id) ?? 0,
      },
    ]),
  )

  const roots: OrgNode[] = []
  nodes.forEach((node) => {
    const parent = nodes.get(node.parentId)
    if (parent && node.parentId !== 0) {
      parent.children.push(node)
    } else if (node.type === 'supervisor' || node.type === 'tenant') {
      roots.push(node)
    }
  })
  return roots
}

// ─────────────────────────────────────────────
// Coaching feedback analysis — lazy, on-demand only
// ─────────────────────────────────────────────

export interface FeedbackEntry {
  simId: number
  userName: string | null
  round: number
  question: string
  response: string
  feedback: string
  points: number
}

/**
 * Extracts per-interaction feedback from simulations.
 * NOT called eagerly — must be explicitly invoked (drilldown, export, etc.).
 * O(5N) — expensive on large datasets.
 */
export function extractFeedback(sims: Simulation[]): FeedbackEntry[] {
  const entries: FeedbackEntry[] = []
  sims.forEach((s) => {
    for (let i = 1; i <= 5; i++) {
      const puntos   = s[`Puntos_${i}` as keyof Simulation]
      if (!isApplicable(puntos)) continue
      const feedback = s[`Retroalimentacion_${i}` as keyof Simulation] as string | null
      if (!feedback) continue
      entries.push({
        simId:    s.ID_Sim,
        userName: s.Usuario_Nombre,
        round:    i,
        question: (s[`Pregunta_${i}` as keyof Simulation] as string | null) ?? '',
        response: (s[`Respuesta_${i}` as keyof Simulation] as string | null) ?? '',
        feedback,
        points: puntos,
      })
    }
  })
  return entries
}

// ─────────────────────────────────────────────
// Line (Dim_Line / tag1) statistics — Sanfer-specific
// ─────────────────────────────────────────────

export interface LineStat {
  id: number
  name: string
  memberCount: number
  simCount: number
  avgScore: number
  passRate: number
  passCount: number
  activeUsers: number
}

// Certification exercises belong to exactly one línea (only #420 is shared by
// two), so the exercise itself identifies the line when the member lookup fails.
const EXERCISE_TO_LINES = (() => {
  const map = new Map<number, number[]>()
  for (const line of CERT_LINES)
    for (const sim of line.sims)
      map.set(sim.saexId, [...(map.get(sim.saexId) ?? []), line.tagId])
  return map
})()

export function computeLineStats(
  lines: LineTag[],
  members: Member[],
  sims: Simulation[],
): LineStat[] {
  const membersByLine = new Map<number, Member[]>()
  members.forEach((m) => {
    if (!m.mb_idTag1) return
    if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, [])
    membersByLine.get(m.mb_idTag1)!.push(m)
  })

  const userToLine = new Map<string, number>()
  members.forEach((m) => {
    if (m.mb_idTag1 && m.mb_user) userToLine.set(m.mb_user.toLowerCase(), m.mb_idTag1)
  })

  const simsByLine = new Map<number, Simulation[]>()
  sims.forEach((s) => {
    if (!s.Usuario) return
    // 1st: the advisor's member record names their line.
    // 2nd: some advisors exist only in the simulator (no member record) —
    //      attribute by the exercise's owning line, unless it's ambiguous (#420).
    let lineId = userToLine.get(s.Usuario.toLowerCase())
    if (!lineId) {
      const owners = EXERCISE_TO_LINES.get(s.ID_Caso_de_Uso)
      if (owners?.length === 1) lineId = owners[0]
    }
    if (!lineId) return
    if (!simsByLine.has(lineId)) simsByLine.set(lineId, [])
    simsByLine.get(lineId)!.push(s)
  })

  return lines.map((line) => {
    const lineMembers = membersByLine.get(line.id) ?? []
    const lineSims    = simsByLine.get(line.id)    ?? []
    const passCount   = lineSims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    const scores      = lineSims.map((s) => Number(s.Calificacion)).filter((n) => Number.isFinite(n))
    return {
      id:          line.id,
      name:        line.name,
      memberCount: lineMembers.length,
      simCount:    lineSims.length,
      avgScore:    scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      passRate:    lineSims.length ? Math.round((passCount / lineSims.length) * 100) : 0,
      passCount,
      activeUsers: new Set(lineSims.map((s) => s.Usuario_Nombre).filter(Boolean)).size,
    }
  }).sort((a, b) => b.simCount - a.simCount)
}

// ─────────────────────────────────────────────
// Certification summary (for AI context)
// ─────────────────────────────────────────────

export interface CertLineSummary {
  name:           string
  jefe:           string
  certifiedCount: number
  memberCount:    number
}

export interface CertSummary {
  totalCertified: number
  byLine:         CertLineSummary[]
}

// Completion-only: certified = has attempted every assigned sim (CTO confirmed)

export function computeCertSummary(certSims: Simulation[], members: Member[]): CertSummary {
  const membersByLine = new Map<number, Set<string>>()
  for (const m of members) {
    if (m.mb_status !== 1 || !m.mb_idTag1 || !m.mb_user) continue
    const email = m.mb_user.toLowerCase()
    if (email.includes('rolplay')) continue
    if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, new Set())
    membersByLine.get(m.mb_idTag1)!.add(email)
  }

  const bestScore = new Map<string, Map<number, number>>()
  for (const s of certSims) {
    const email = (s.Usuario ?? '').toLowerCase()
    if (!email) continue
    if (!bestScore.has(email)) bestScore.set(email, new Map())
    const mine = bestScore.get(email)!
    mine.set(s.ID_Caso_de_Uso, Math.max(mine.get(s.ID_Caso_de_Uso) ?? 0, s.Calificacion))
  }

  // Per-line criterion: certified = completed all 3 sims assigned to their specific line.
  const emailToTagId = new Map<string, number>()
  for (const m of members) {
    if (!m.mb_user || !m.mb_idTag1) continue
    emailToTagId.set(m.mb_user.toLowerCase(), m.mb_idTag1)
  }
  const tagIdToSims = new Map<number, number[]>()
  for (const line of CERT_LINES) {
    tagIdToSims.set(line.tagId, line.sims.map((s) => s.saexId))
  }
  const certifiedSet = new Set<string>()
  for (const [email, mine] of bestScore) {
    const required = tagIdToSims.get(emailToTagId.get(email) ?? 0)
    if (required?.every((id) => mine.has(id))) certifiedSet.add(email)
  }

  const byLine = CERT_LINES.map((line) => {
    const lineMembers = membersByLine.get(line.tagId) ?? new Set<string>()
    const certifiedCount = [...lineMembers].filter((e) => certifiedSet.has(e)).length
    return { name: line.name, jefe: line.jefe, certifiedCount, memberCount: lineMembers.size }
  })

  return { totalCertified: certifiedSet.size, byLine }
}

// ─────────────────────────────────────────────
// AI Context String (for Gemini)
// ─────────────────────────────────────────────

export interface AIContextExtra {
  dateFrom?:  string | null
  dateTo?:    string | null
  scoreDist?: ScoreBucket[]
  pageBlock?: string       // page-specific data block, caller-assembled
}

export function buildAIContext(
  kpis: DashboardKPIs,
  sims: Simulation[],
  activities: Activity[],
  actStats: ActivityStat[],
  userStats: UserStat[],
  objections: import('../api/types').ObjectionStat[] = [],
  certSummary?: CertSummary,
  extra: AIContextExtra = {},
): string {
  const { dateFrom, dateTo, scoreDist, pageBlock } = extra

  const dateLabel = (dateFrom || dateTo)
    ? `${dateFrom ?? '(default start)'} → ${dateTo ?? '(today)'}`
    : 'last 30 days (default)'

  const allUsersBlock = userStats.length === 0 ? '  (no data)' :
    userStats.map((u, i) => `  ${i + 1}. ${u.name}: avg ${u.avgScore}%, ${u.count} sims, best ${u.bestScore}%`).join('\n')

  const bottomCoaching = userStats.length > 10
    ? '\nBottom 10 (coaching priority, lowest avg score):\n' +
      [...userStats].sort((a, b) => a.avgScore - b.avgScore).slice(0, 10)
        .map((u) => `  ${u.name}: avg ${u.avgScore}%, ${u.count} sims`).join('\n')
    : ''

  const actList  = actStats.map((a) => `${a.name}: ${a.count} sims, avg ${a.avgScore}%`).join('; ')
  const recent10 = sims.slice(-10).map((s) => `${s.Usuario_Nombre}: ${s.Calificacion}% ${s.Diagnostico_Final} (${s.Fecha_y_Hora?.substring(0, 10) ?? ''})`).join(', ')

  const roundStats = (() => {
    const rows = ([1, 2, 3, 4, 5] as const).map((r) => {
      const key = `Puntos_${r}` as keyof Simulation
      const scored = sims.filter((s) => {
        const v = s[key]
        return v !== null && v !== undefined && v !== 'No aplica'
      })
      if (scored.length === 0) return null
      const passed = scored.filter((s) => Number(s[key]) === 1).length
      const pct = Math.round(passed / scored.length * 100)
      return `  Round ${r}: ${passed}/${scored.length} passed (${pct}%)`
    }).filter(Boolean)
    return rows.length ? rows.join('\n') : '  (no round data)'
  })()

  const distBlock = (scoreDist && scoreDist.length)
    ? `\nScore Distribution:\n${scoreDist.map((b) => `  ${b.label}%: ${b.count} sessions`).join('\n')}`
    : ''

  const objBlock = objections.length === 0
    ? 'No objection data for current range.'
    : objections.map((o, i) => {
        const modelLine = o.model_answer
          ? `\n   Ideal answer: "${o.model_answer.slice(0, 600)}"`
          : ''
        const repLines = o.top_answers && o.top_answers.length > 0
          ? '\n   Sample rep responses:\n' + o.top_answers.map((r, ri) => `     ${ri + 1}. "${r.slice(0, 500)}"`).join('\n')
          : ''
        return `  ${i + 1}. "${o.objection_text}" — ${o.count}x, ${o.pass_rate}% pass rate${modelLine}${repLines}`
      }).join('\n\n')

  const certBlock = certSummary ? `
CERTIFICATION ("Certificación Sanfer — Junio 2026"):
Window: ${CERT_WINDOW.from} → ${CERT_WINDOW.to ?? 'today'} | Rule: completed ≥${CERT_MIN_SIMS} of the assigned simulators
Total Certified: ${certSummary.totalCertified} (official platform: ${CERT_OFFICIAL_TOTAL})

By línea:
${certSummary.byLine.map((l) => {
  const pct = l.memberCount > 0 ? Math.round(l.certifiedCount / l.memberCount * 100) : 0
  return `  ${l.name} (${l.jefe}): ${l.certifiedCount}/${l.memberCount} = ${pct}%`
}).join('\n')}

By jefe:
${Object.entries(
  certSummary.byLine.reduce<Record<string, { cert: number; total: number }>>((acc, l) => {
    if (!acc[l.jefe]) acc[l.jefe] = { cert: 0, total: 0 }
    acc[l.jefe].cert  += l.certifiedCount
    acc[l.jefe].total += l.memberCount
    return acc
  }, {}),
).map(([jefe, v]) => `  ${jefe}: ${v.cert}/${v.total} certified (${v.total > 0 ? Math.round(v.cert / v.total * 100) : 0}%)`).join('\n')}` : ''

  return `
SANFER SALES TRAINING INTELLIGENCE PLATFORM — LIVE DASHBOARD DATA
Date Range: ${dateLabel}
------------------------------------------------------------------
Total Simulations: ${kpis.totalSimulations}
Average Score: ${kpis.averageScore}%
Active Advisors: ${kpis.activeAdvisors}
Total Members (registered): ${kpis.totalMembers} | Admins: ${kpis.totalAdmins} | Supervisors: ${kpis.totalSupervisors}
Best Score: ${kpis.bestScore}% | Lowest Score: ${kpis.worstScore}%
${distBlock}
Per-Round Scores (rounds 1–5, scored=1 means rep answered correctly):
${roundStats}

All ${userStats.length} Advisors Ranked by Avg Score (current period):
${allUsersBlock}
${bottomCoaching}

Activity Breakdown (sessions per activity):
${actList}

Recent Sessions (last 10):
${recent10}
${certBlock}
OBJECTION HANDLING ("Manejo de Objeciones") — all ${objections.length} unique objections, sorted hardest first:
${objBlock}
${pageBlock ? `\n${pageBlock}` : ''}
  `.trim()
}
