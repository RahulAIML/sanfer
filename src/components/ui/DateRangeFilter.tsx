import { Calendar } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  label?: string
  className?: string
}

export function DateRangeFilter({ from, to, onFrom, onTo, label, className }: Props) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {label && (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          {label}
        </span>
      )}
      <input
        type="date"
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        className="bg-surface border border-line text-slate-300 text-xs rounded-lg px-1.5 sm:px-2.5 py-1.5 focus:outline-none focus:border-accent cursor-pointer min-w-0 w-[120px] sm:w-auto"
      />
      <span className="text-xs text-slate-600">—</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onTo(e.target.value)}
        className="bg-surface border border-line text-slate-300 text-xs rounded-lg px-1.5 sm:px-2.5 py-1.5 focus:outline-none focus:border-accent cursor-pointer min-w-0 w-[120px] sm:w-auto"
      />
    </div>
  )
}

// Returns true if isoDate (YYYY-MM-DD) is within [from, to] (inclusive)
// Empty string means unbounded.
export function inDateRange(isoDate: string, from: string, to: string): boolean {
  if (!isoDate || isoDate === 'unknown') return false
  if (from && isoDate < from) return false
  if (to   && isoDate > to)   return false
  return true
}
