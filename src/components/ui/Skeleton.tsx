import { cn } from '../../lib/cn'

interface Props {
  className?: string
  rounded?: boolean
  lines?: number
  style?: React.CSSProperties
}

export function Skeleton({ className, rounded = false }: Props) {
  return (
    <div
      className={cn(
        'skeleton',
        rounded ? 'rounded-full' : 'rounded-lg',
        className,
      )}
    />
  )
}

export function KPICardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  )
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="card p-5">
      <Skeleton className="h-5 w-40 mb-6" />
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-line/40">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="divide-y divide-line/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-6 rounded" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
