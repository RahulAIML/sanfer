import { useEffect } from 'react'
import { X, Download, FileText } from 'lucide-react'
import { useSimReport } from '../../api/queries'
import { useTranslation } from '../../lib/i18n'
import type { Language } from '../../store'
import type { SimReport } from '../../api/types'

/** Verdict answers are short "Si"/"No" — color them like the status badges */
function verdictColor(a: string): string | null {
  const v = a.trim().toLowerCase()
  if (v === 'si' || v === 'sí') return 'text-success'
  if (v === 'no') return 'text-danger'
  return null
}

function buildDownloadHTML(r: SimReport): string {
  const rows = r.Secciones.map((s) => `
    <h3>${s.q}</h3>
    <p>${s.a.replace(/\n/g, '<br>')}</p>`).join('\n')
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte — ${r.Usuario_Nombre ?? ''} — ${r.Titulo}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;margin:0;padding:24px;color:#1e293b}
  .doc{max-width:720px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .head{background:#1b2a49;color:#fff;padding:24px 28px}
  .head h1{margin:0 0 6px;font-size:20px}
  .head p{margin:0;font-size:13px;opacity:.8}
  .body{padding:20px 28px 28px}
  h3{font-size:14px;color:#1b2a49;margin:18px 0 6px}
  p{font-size:13px;line-height:1.55;margin:0;color:#475569}
</style></head><body><div class="doc">
  <div class="head">
    <h1>${r.Titulo}</h1>
    <p>${r.Usuario_Nombre ?? ''} · ${(r.Fecha_y_Hora ?? '').substring(0, 16)} · ${r.Calificacion}%</p>
  </div>
  <div class="body">${rows}</div>
</div></body></html>`
}

function downloadReport(r: SimReport) {
  const blob = new Blob([buildDownloadHTML(r)], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `reporte_sim_${r.ID_Sim}.html`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  simId: number
  language: Language
  onClose: () => void
}

export function SimReportModal({ simId, language, onClose }: Props) {
  const t = useTranslation(language)
  const { data: report, isLoading, isError } = useSimReport(simId)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('report_title')}
    >
      <div
        className="bg-card border border-line rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line/40">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100 leading-snug">
                {report?.Titulo || t('report_title')}
              </h2>
              {report && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {report.Usuario_Nombre} · {(report.Fecha_y_Hora ?? '').substring(0, 16)} · {report.Calificacion}%
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            title={t('report_close')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{t('report_loading')}</p>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 skeleton rounded-lg" />
              ))}
            </div>
          )}
          {isError && <p className="text-sm text-danger">{t('report_error')}</p>}
          {report && (
            <div className="space-y-4">
              {report.Secciones.map((sec, i) => {
                const vc = verdictColor(sec.a)
                return (
                  <div key={i}>
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">{sec.q}</h3>
                    {vc ? (
                      <p className={`text-lg font-bold ${vc}`}>{sec.a}</p>
                    ) : (
                      <div className="text-sm text-slate-400 leading-relaxed space-y-1">
                        {sec.a.split('\n').map((line, j) =>
                          line.trim() ? <p key={j}>{sec.a.includes('\n') ? '• ' : ''}{line}</p> : null,
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line/40">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg border border-line/50 hover:border-line transition-colors">
            {t('report_close')}
          </button>
          <button
            onClick={() => report && downloadReport(report)}
            disabled={!report}
            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            {t('report_download')}
          </button>
        </div>
      </div>
    </div>
  )
}
