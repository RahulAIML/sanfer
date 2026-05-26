import { type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  title: string
  subtitle?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, icon: Icon, actions, className }: Props) {
  return (
    <div className={cn('flex items-start justify-between mb-6', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-accent" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>
      )}
    </div>
  )
}
