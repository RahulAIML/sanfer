import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'

export default function CoachingPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { isLoading, isError, kpis, userStats, actStats, roundStats, refetch } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5 h-64 skeleton rounded-xl" />
          <div className="card p-5 h-64 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !kpis) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={refetch} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  const lowPerformers = (userStats ?? []).filter((u) => u.avgScore < 60).slice(0, 5)
  const weakActivities = (actStats ?? []).filter((a) => a.passRate < 60).slice(0, 5)
  const weakRounds = (roundStats ?? []).filter((r) => r.passRate < 60)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_coaching_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_coaching_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Strengths */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-success" />
            <h3 className="text-sm font-semibold text-slate-200">{t('coaching_strengths')}</h3>
          </div>
          <div className="space-y-2">
            {(userStats ?? []).slice(0, 5).map((u) => (
              <div key={u.name} className="flex items-center justify-between p-2 rounded-lg bg-success/5 border border-success/10">
                <span className="text-xs text-slate-300 truncate flex-1 min-w-0">{u.name}</span>
                <span className="text-xs font-bold text-success">{u.avgScore}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement areas */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-slate-200">{t('coaching_improve')}</h3>
          </div>
          <div className="space-y-2">
            {lowPerformers.length > 0 ? (
              lowPerformers.map((u) => (
                <div key={u.name} className="flex items-center justify-between p-2 rounded-lg bg-warning/5 border border-warning/10">
                  <span className="text-xs text-slate-300 truncate flex-1 min-w-0">{u.name}</span>
                  <span className="text-xs font-bold text-warning">{u.avgScore}%</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">{t('coaching_all_above')}</p>
            )}
          </div>
        </div>

        {/* Coaching tips */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-slate-200">{t('coaching_tips')}</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            {weakRounds.length > 0 && (
              <p>{t('coaching_tip_rounds')} {weakRounds.map((r) => `${t('round')} ${r.round}`).join(', ')}.</p>
            )}
            {weakActivities.length > 0 && (
              <p>{t('coaching_tip_activities')} {weakActivities.map((a) => a.name).join(', ')}.</p>
            )}
            <p>{t('coaching_tip_avg')} {kpis.averageScore}{t('coaching_tip_avg2')} {Math.min(100, kpis.averageScore + 10)}%.</p>
            <p>{t('coaching_tip_pass')} {kpis.passRate}{t('coaching_tip_pass2')}</p>
          </div>
        </div>
      </div>

    </div>
  )
}
