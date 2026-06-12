import { useEffect, useState } from 'react'
import { X, Download, FileText, Loader2, Stethoscope, User, CheckCircle2, XCircle, ClipboardList } from 'lucide-react'
import { useSimReport } from '../../api/queries'
import { useTranslation } from '../../lib/i18n'
import { downloadReportPDF } from '../../lib/reportPdf'
import type { Language } from '../../store'
import type { SimRonda } from '../../api/types'
import { cn } from '../../lib/cn'

interface Props {
  simId: number
  language: Language
  onClose: () => void
}

function verdictColor(a: string): string | null {
  const v = a.trim().toLowerCase()
  if (v === 'si' || v === 'sí') return 'text-success'
  if (v === 'no') return 'text-danger'
  return null
}

function ScoreBadge({ pts, max }: { pts: number | null; max: number }) {
  if (pts === null) {
    return <span className="text-[10px] text-slate-600 border border-line/30 rounded-full px-2 py-0.5">—</span>
  }
  const pass = pts >= max
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border',
      pass ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30',
    )}>
      {pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {pts} / {max} pt
    </span>
  )
}

function RondaCard({ ronda, es }: { ronda: SimRonda; es: boolean }) {
  const hasFeedback = ronda.criterio || ronda.respuesta_modelo || ronda.analisis
  return (
    <div className="border border-line/30 rounded-xl overflow-hidden bg-white/[0.01]">
      {/* Round header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-line/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {es ? `Interacción ${ronda.n}` : `Interaction ${ronda.n}`}
        </span>
        <ScoreBadge pts={ronda.puntos} max={ronda.max_puntos} />
      </div>

      <div className="p-4 space-y-3">
        {/* Doctor statement */}
        {ronda.pregunta && (
          <div className="flex gap-2.5 items-start">
            <div className="w-7 h-7 rounded-full bg-[#1b2a49] border border-blue-900/60 flex items-center justify-center shrink-0 mt-0.5">
              <Stethoscope className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div className="flex-1 bg-[#1b2a49]/30 border border-blue-900/30 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-blue-400/60 font-semibold mb-0.5 uppercase tracking-wide">
                {es ? 'Médico' : 'Doctor'}
              </p>
              <p className="text-sm text-slate-200 leading-relaxed">{ronda.pregunta}</p>
            </div>
          </div>
        )}

        {/* Rep's answer */}
        <div className="flex gap-2.5 items-start">
          <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-accent" />
          </div>
          {ronda.respuesta_rep ? (
            <div className="flex-1 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-accent/60 font-semibold mb-0.5 uppercase tracking-wide">
                {es ? 'Representante' : 'Sales Rep'}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{ronda.respuesta_rep}</p>
            </div>
          ) : (
            <div className="flex-1 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2.5">
              <p className="text-xs text-yellow-400/70 italic">
                {es ? 'No se encontró transcripción en la respuesta.' : 'No transcription found in response.'}
              </p>
            </div>
          )}
        </div>

        {/* Evaluation feedback */}
        {hasFeedback && (
          <div className="pt-3 border-t border-line/20 space-y-3">
            {ronda.criterio && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {es ? 'Criterio a evaluar' : 'Evaluation Criteria'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{ronda.criterio}</p>
              </div>
            )}
            {ronda.respuesta_modelo && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {es ? 'Respuesta modelo' : 'Model Answer'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{ronda.respuesta_modelo}</p>
              </div>
            )}
            {ronda.analisis && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {es ? 'Análisis de tu respuesta' : 'Response Analysis'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{ronda.analisis}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function SimReportModal({ simId, language, onClose }: Props) {
  const t  = useTranslation(language)
  const es = language === 'es'
  const { data: report, isLoading, isError } = useSimReport(simId)
  const [pdfBusy, setPdfBusy] = useState(false)

  async function handleDownload() {
    if (!report || pdfBusy) return
    setPdfBusy(true)
    try { await downloadReportPDF(report) } finally { setPdfBusy(false) }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const score    = report?.Calificacion ?? 0
  const product  = report?.Producto || report?.Titulo || t('report_title')
  const rondas   = report?.Rondas ?? []
  const totalPts = rondas.reduce((s, r) => s + (r.puntos ?? 0), 0)
  const scoredN  = rondas.filter((r) => r.puntos !== null).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-line rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[94dvh] sm:max-h-[88vh] flex flex-col shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-line/40 bg-[#1b2a49]/20 rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-[#1b2a49] border border-blue-900/50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-100 leading-snug truncate">{product}</h2>
                {report && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {report.Usuario_Nombre} · {(report.Fecha_y_Hora ?? '').substring(0, 16)}
                  </p>
                )}
                {report && (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="w-28 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', score >= 70 ? 'bg-success' : score >= 40 ? 'bg-yellow-400' : 'bg-danger')}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className={cn('text-sm font-bold tabular-nums', score >= 70 ? 'text-success' : score >= 40 ? 'text-yellow-400' : 'text-danger')}>
                      {score}%
                    </span>
                    {scoredN > 0 && (
                      <span className="text-[11px] text-slate-600 tabular-nums">
                        {totalPts}/{scoredN} {es ? 'pts' : 'pts'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
          {isLoading && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-52 skeleton rounded-xl" />
              ))}
            </>
          )}
          {isError && <p className="text-sm text-danger">{t('report_error')}</p>}

          {report && (
            <>
              {/* Interaction rounds */}
              {rondas.map((ronda) => (
                <RondaCard key={ronda.n} ronda={ronda} es={es} />
              ))}

              {/* Closing assessment */}
              {report.Secciones?.length > 0 && (
                <div className="border border-line/30 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-line/20">
                    <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {es ? 'Evaluación Final' : 'Final Assessment'}
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    {report.Secciones.map((sec, i) => {
                      const vc = verdictColor(sec.a)
                      return (
                        <div key={i}>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{sec.q}</p>
                          {vc ? (
                            <p className={`text-base font-bold ${vc}`}>{sec.a}</p>
                          ) : (
                            <div className="text-xs text-slate-400 leading-relaxed space-y-1">
                              {sec.a.split('\n').map((line, j) =>
                                line.trim() ? <p key={j}>{sec.a.includes('\n') ? '• ' : ''}{line}</p> : null,
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Fallback if neither rounds nor sections */}
              {rondas.length === 0 && report.Secciones?.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">{t('no_data')}</p>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line/40">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg border border-line/50 hover:border-line transition-colors"
          >
            {t('report_close')}
          </button>
          <button
            onClick={handleDownload}
            disabled={!report || pdfBusy}
            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2 disabled:opacity-40"
          >
            {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {t('report_download')}
          </button>
        </div>
      </div>
    </div>
  )
}
