import { cn } from '../../lib/cn'

type Variant = 'pass' | 'fail' | 'neutral' | 'blue' | 'violet' | 'amber'

const STYLES: Record<Variant, string> = {
  pass:    'bg-success/10 text-success border border-success/20',
  fail:    'bg-danger/10 text-danger border border-danger/20',
  neutral: 'bg-slate-800 text-slate-400 border border-slate-700',
  blue:    'bg-accent/10 text-accent border border-accent/20',
  violet:  'bg-violet/10 text-violet border border-violet/20',
  amber:   'bg-warning/10 text-warning border border-warning/20',
}

interface Props {
  variant?: Variant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ variant = 'neutral', children, className, dot }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium',
        STYLES[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'pass' ? 'bg-success' :
            variant === 'fail' ? 'bg-danger' :
            variant === 'blue' ? 'bg-accent' :
            variant === 'violet' ? 'bg-violet' :
            variant === 'amber' ? 'bg-warning' :
            'bg-slate-500',
          )}
        />
      )}
      {children}
    </span>
  )
}
