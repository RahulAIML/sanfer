import { useState, useMemo } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { useDebounce } from '../lib/useDebounce'
import { Trophy, Medal, TrendingUp, TrendingDown, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 25

export default function LeaderboardPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { isLoading, isError, userStats, refetch } = useDashboardData()

  // All hooks before any conditional return
  const [searchRaw, setSearchRaw] = useState('')
  const [limitN,    setLimitN]    = useState<number>(0)
  const [page,      setPage]      = useState(0)

  const search  = useDebounce(searchRaw, 300)

  const allRows = userStats ?? []

  const rows = useMemo(() => {
    let result = allRows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((u) => u.name.toLowerCase().includes(q))
    }
    return limitN > 0 ? result.slice(0, limitN) : result
  }, [allRows, search, limitN])

  const totalPages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const displayPage = Math.min(page, totalPages - 1)

  const paginated = useMemo(
    () => rows.slice(displayPage * PAGE_SIZE, (displayPage + 1) * PAGE_SIZE),
    [rows, displayPage],
  )

  const es = language === 'es'

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded-lg" />
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

  function handleSearch(val: string) {
    setSearchRaw(val)
    setPage(0)
  }

  function handleLimit(val: number) {
    setLimitN(val)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_leader_title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('page_leader_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              value={searchRaw}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={es ? 'Buscar asesor...' : 'Search advisor...'}
              className="bg-surface border border-line text-slate-300 text-xs rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:border-accent w-36 sm:w-48"
            />
            {searchRaw && (
              <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <select
            value={limitN}
            onChange={(e) => handleLimit(Number(e.target.value))}
            className="bg-surface border border-line text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value={0}>{es ? 'Todos' : 'All'}</option>
            <option value={10}>Top 10</option>
            <option value={25}>Top 25</option>
            <option value={50}>Top 50</option>
          </select>
          {(searchRaw || limitN > 0) && (
            <span className="text-[11px] text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
              {rows.length} / {allRows.length} {es ? 'asesores' : 'advisors'}
            </span>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/40">
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10 sm:w-12">{t('col_rank')}</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_advisor')}</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right hidden sm:table-cell">{t('col_simulations')}</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">{t('col_avg_score')}</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right hidden sm:table-cell">{t('col_pass_rate')}</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">{t('col_best')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u, i) => {
                const globalRank = displayPage * PAGE_SIZE + i
                return (
                  <tr key={u.name} className="border-b border-line/20 hover:bg-white/[0.02] transition-colors">
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <RankBadge rank={globalRank} />
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-200 font-medium text-sm truncate max-w-[140px] sm:max-w-none">{u.name}</span>
                        {globalRank === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-slate-400 hidden sm:table-cell">{u.count}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.avgScore >= 60
                          ? <TrendingUp   className="w-3 h-3 text-success shrink-0" />
                          : <TrendingDown className="w-3 h-3 text-danger shrink-0" />}
                        <span className={`font-semibold text-sm ${u.avgScore >= 60 ? 'text-success' : 'text-danger'}`}>{u.avgScore}%</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-slate-400 hidden sm:table-cell">{u.passRate}%</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-slate-200 hidden md:table-cell">{u.bestScore}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {paginated.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">{t('no_data')}</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {es
              ? `Mostrando ${displayPage * PAGE_SIZE + 1}–${Math.min((displayPage + 1) * PAGE_SIZE, rows.length)} de ${rows.length}`
              : `Showing ${displayPage * PAGE_SIZE + 1}–${Math.min((displayPage + 1) * PAGE_SIZE, rows.length)} of ${rows.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={displayPage === 0}
              className="p-1.5 rounded-lg border border-line/50 disabled:opacity-30 hover:border-line transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 tabular-nums">{displayPage + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={displayPage >= totalPages - 1}
              className="p-1.5 rounded-lg border border-line/50 disabled:opacity-30 hover:border-line transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return (
    <div className="w-7 h-7 rounded-full bg-yellow-500/15 flex items-center justify-center">
      <Medal className="w-3.5 h-3.5 text-yellow-500" />
    </div>
  )
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full bg-slate-400/15 flex items-center justify-center text-xs font-bold text-slate-300">2</div>
  )
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full bg-orange-500/15 flex items-center justify-center text-xs font-bold text-orange-400">3</div>
  )
  return (
    <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-xs font-medium text-slate-600">{rank + 1}</div>
  )
}
