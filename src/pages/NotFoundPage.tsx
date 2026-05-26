import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { Home, AlertTriangle } from 'lucide-react'

export default function NotFoundPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-warning" />
      </div>
      <div>
        <h1 className="text-4xl font-bold text-slate-50 mb-2">404</h1>
        <p className="text-slate-500">Page not found</p>
      </div>
      <Link to="/" className="btn-primary">
        <Home className="w-4 h-4" />
        {t('nav_overview')}
      </Link>
    </div>
  )
}
