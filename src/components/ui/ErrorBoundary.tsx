import { Component, type ReactNode } from 'react'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <Fallback />
    }
    return this.props.children
  }
}

function Fallback() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-danger" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Something went wrong</h2>
        <p className="text-sm text-slate-500">An unexpected error occurred.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        <RefreshCw className="w-4 h-4" />
        {t('retry')}
      </button>
    </div>
  )
}

export function ErrorBoundary({ children }: Props) {
  return <ErrorBoundaryInner>{children}</ErrorBoundaryInner>
}
