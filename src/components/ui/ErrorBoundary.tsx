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

// ── Compact inline boundary for individual sections ──────────────────────────

interface SectionState {
  hasError: boolean
  errorMsg: string
}

interface SectionProps {
  children: ReactNode
  label?: string
}

class SectionErrorBoundaryInner extends Component<SectionProps, SectionState> {
  constructor(props: SectionProps) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-5 flex flex-col items-center gap-2 text-center">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <p className="text-xs text-slate-500">
            {this.props.label ? `${this.props.label} failed to render` : 'Section unavailable'}
          </p>
          <button
            className="text-[11px] text-accent hover:underline"
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function SectionErrorBoundary({ children, label }: SectionProps) {
  return <SectionErrorBoundaryInner label={label}>{children}</SectionErrorBoundaryInner>
}
