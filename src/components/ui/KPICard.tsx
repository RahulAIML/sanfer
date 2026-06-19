import { memo } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'indigo'

const VARIANT_STYLES: Record<Variant, { icon: string; accent: string; badge: string }> = {
  blue:   { icon: 'bg-accent/10 text-accent',   accent: 'text-accent',   badge: 'text-accent bg-accent/10' },
  green:  { icon: 'bg-success/10 text-success', accent: 'text-success',  badge: 'text-success bg-success/10' },
  amber:  { icon: 'bg-warning/10 text-warning', accent: 'text-warning',  badge: 'text-warning bg-warning/10' },
  red:    { icon: 'bg-danger/10 text-danger',   accent: 'text-danger',   badge: 'text-danger bg-danger/10' },
  violet: { icon: 'bg-violet/10 text-violet',   accent: 'text-violet',   badge: 'text-violet bg-violet/10' },
  indigo: { icon: 'bg-indigo/10 text-indigo',   accent: 'text-indigo',   badge: 'text-indigo bg-indigo/10' },
}

interface Props {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  variant?: Variant
  delta?: number
  suffix?: string
  className?: string
  index?: number
}

export const KPICard = memo(function KPICard({
  label,
  value,
  sublabel,
  icon: Icon,
  variant = 'blue',
  delta,
  suffix,
  className,
  index = 0,
}: Props) {
  const v = VARIANT_STYLES[variant]

  return (
    <div
      className={cn('card p-4 sm:p-5 flex flex-col gap-3 kpi-card-in', className)}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 leading-tight tracking-wide">{label}</p>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', v.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span className={cn('text-2xl sm:text-3xl font-bold tracking-tight tabular-nums leading-none', v.accent)}>
          {value}
          {suffix && <span className="text-lg text-slate-500 ml-0.5 font-semibold">{suffix}</span>}
        </span>
        {delta !== undefined && (
          <span className={cn(
            'text-[11px] font-semibold px-1.5 py-0.5 rounded-md mb-0.5',
            delta >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10',
          )}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>

      {sublabel && (
        <p className="text-[11px] text-slate-600 leading-snug">{sublabel}</p>
      )}
    </div>
  )
})
