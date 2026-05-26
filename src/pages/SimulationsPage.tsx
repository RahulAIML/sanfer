import { useState, Fragment } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { Search, Calendar, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/cn'

export default function SimulationsPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { isLoading, isError, sims, activities, refetch } = useDashboardData()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const actMap = new Map(activities.map((a) => [a.ID_Caso_de_Uso, a]))

  const filtered = sims.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.Usuario_Nombre.toLowerCase().includes(q) ||
      actMap.get(s.ID_Caso_de_Uso)?.Caso_de_Uso?.toLowerCase().includes(q) ||
      s.Fecha_y_Hora.includes(q)
    )
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 skeleton rounded-lg" />
        <div className="card p-5 h-96 skeleton rounded-xl" />
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_sims_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_sims_subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filter_search')}
            className="input w-full pl-9"
          />
        </div>
        <span className="text-xs text-slate-600 ml-auto">
          {filtered.length} {t('simulations_count')}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/40">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_advisor')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_activity')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_date')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_score')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_status')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_details')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const expanded = expandedId === s.ID_Sim
                const activity = actMap.get(s.ID_Caso_de_Uso)
                return (
                  <Fragment key={s.ID_Sim}>
                    <tr
                      className="border-b border-line/20 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : s.ID_Sim)}
                    >
                      <td className="px-4 py-3 text-slate-200 font-medium">{s.Usuario_Nombre}</td>
                      <td className="px-4 py-3 text-slate-400">{activity?.Caso_de_Uso ?? `ID ${s.ID_Caso_de_Uso}`}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.Fecha_y_Hora.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-semibold',
                          s.Calificacion >= 60 ? 'text-success' : 'text-danger'
                        )}>
                          {s.Calificacion}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.Diagnostico_Final === 'Si' ? (
                          <span className="badge bg-success/10 text-success">
                            <CheckCircle2 className="w-3 h-3" /> {t('status_pass')}
                          </span>
                        ) : (
                          <span className="badge bg-danger/10 text-danger">
                            <XCircle className="w-3 h-3" /> {t('status_fail')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-surface/50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6].map((r) => {
                              const q    = s[`Pregunta_${r}` as keyof typeof s] as string | null
                              const resp = s[`Respuesta_${r}` as keyof typeof s] as string | null
                              const pts  = s[`Puntos_${r}` as keyof typeof s] as number | string | null
                              const fb   = s[`Retroalimentacion_${r}` as keyof typeof s] as string | null
                              // Only show if there is a question AND Puntos is a real number
                              // Puntos_6 is "No aplica" across all current simulators — skip it
                              if (!q || typeof pts !== 'number') return null
                              return (
                                <div key={r} className="card p-3 border border-line/40">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('round')} {r}</span>
                                    <span className={cn('text-xs font-bold', (pts ?? 0) > 0 ? 'text-success' : 'text-danger')}>
                                      {pts ?? 0} {t('points')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mb-1 line-clamp-2">{q}</p>
                                  {resp && <p className="text-xs text-slate-500 line-clamp-2 mb-1">{resp}</p>}
                                  {fb && <p className="text-[11px] text-slate-600 bg-surface rounded px-2 py-1">{fb}</p>}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">{t('no_data')}</div>
        )}
      </div>
    </div>
  )
}
