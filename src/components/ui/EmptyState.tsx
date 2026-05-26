import { type LucideIcon, InboxIcon } from 'lucide-react'

interface Props {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon: Icon = InboxIcon, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <p className="text-slate-300 font-medium text-sm mb-1">{title}</p>
      {description && (
        <p className="text-slate-600 text-xs max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
        <span className="text-danger text-lg">!</span>
      </div>
      <p className="text-danger font-medium text-sm mb-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 btn-ghost text-xs">
          Retry
        </button>
      )}
    </div>
  )
}
