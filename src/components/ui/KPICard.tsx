import { type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

type Variant = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'indigo'

const VARIANT_STYLES: Record<Variant, { icon: string; glow: string; badge: string }> = {
  blue:   { icon: 'bg-accent/10 text-accent',    glow: 'group-hover:shadow-glow',         badge: 'text-accent bg-accent/10' },
  green:  { icon: 'bg-success/10 text-success',  glow: 'group-hover:shadow-glow-success', badge: 'text-success bg-success/10' },
  amber:  { icon: 'bg-warning/10 text-warning',  glow: '',                                badge: 'text-warning bg-warning/10' },
  red:    { icon: 'bg-danger/10 text-danger',    glow: '',                                badge: 'text-danger bg-danger/10' },
  violet: { icon: 'bg-violet/10 text-violet',    glow: '',                                badge: 'text-violet bg-violet/10' },
  indigo: { icon: 'bg-indigo/10 text-indigo',    glow: '',                                badge: 'text-indigo bg-indigo/10' },
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

export function KPICard({
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
      className={cn(
        'card group p-5 flex flex-col gap-4 transition-all duration-200',
        v.glow,
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-400 leading-tight">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', v.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span className="metric-value">
          {value}
          {suffix && <span className="text-xl text-slate-400 ml-0.5">{suffix}</span>}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded mb-1',
              delta >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10',
            )}
          >
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>

      {/* Sub-label */}
      {sublabel && (
        <p className="text-xs text-slate-600 -mt-2 leading-relaxed">{sublabel}</p>
      )}
    </motion.div>
  )
}
