import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { Activity, CheckCircle2, XCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'

const COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444']

function ActivityBarTooltip({ active, payload, es, c }: { active?: boolean; payload?: any[]; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <TooltipShell c={c} minWidth={180}>
      <TTitle text={d.fullName ?? d.name} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'}      value={d.count}             valueStyle={{ color: d.color }}    c={c} />
      <TRow label={es ? 'Puntaje Prom.' : 'Avg Score'} value={`${d.avgScore}%`}   valueStyle={{ color: c.accent }}   c={c} />
      <TRow label={es ? 'Aprobación' : 'Pass Rate'}    value={`${d.passRate}%`}    valueStyle={{ color: '#10B981' }}  c={c} />
    </TooltipShell>
  )
}

export default function ActivitiesPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const c  = useChartColors()
  const tt = useTooltipColors()
  const es = language === 'es'
  const { isLoading, isError, actStats, refetch } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 skeleton rounded-lg" />
        <div className="card p-5 h-80 skeleton rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={refetch} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  const data = (actStats ?? []).map((a, i) => ({
    name: a.name.length > 20 ? a.name.slice(0, 20) + '...' : a.name,
    fullName: a.name,
    count: a.count,
    avgScore: a.avgScore,
    passRate: a.passRate,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_act_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_act_subtitle')}</p>
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">{t('activity_breakdown')}</h3>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ActivityBarTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ fill: c.cursorFill }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(actStats ?? []).map((a) => (
          <div key={a.id} className="card p-5 card-interactive">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <span className="text-xs text-slate-600 bg-surface px-2 py-0.5 rounded">{a.activityType}</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-200 mb-3 line-clamp-1">{a.name}</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface rounded-lg p-2">
                <p className="text-lg font-bold text-slate-100">{a.count}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{t('col_simulations')}</p>
              </div>
              <div className="bg-surface rounded-lg p-2">
                <p className="text-lg font-bold text-accent">{a.avgScore}%</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{t('col_avg_score')}</p>
              </div>
              <div className="bg-surface rounded-lg p-2">
                <p className="text-lg font-bold text-success">{a.passRate}%</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{t('col_pass_rate')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="w-3 h-3" /> {a.passCount}
              </span>
              <span className="flex items-center gap-1 text-danger">
                <XCircle className="w-3 h-3" /> {a.failCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
