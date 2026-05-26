import type { ReactNode, CSSProperties } from 'react'
import { useAppStore } from '../../store'

export interface TooltipColors {
  bg: string
  border: string
  shadow: string
  title: string
  label: string
  value: string
  accent: string
  success: string
  muted: string
  divider: string
}

export function useTooltipColors(): TooltipColors {
  // White card — maximum contrast on any theme (light, dark, or blue)
  return {
    bg:      '#ffffff',
    border:  'rgba(0,0,0,0.10)',
    shadow:  '0 8px 28px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14)',
    title:   '#0f172a',
    label:   '#475569',
    value:   '#0f172a',
    accent:  '#2563eb',
    success: '#16a34a',
    muted:   '#64748b',
    divider: 'rgba(0,0,0,0.08)',
  }
}

/* ── Presentational shell — receives colors as prop, NO hooks ── */

interface TooltipShellProps {
  children: ReactNode
  minWidth?: number
  c: TooltipColors
}

export function TooltipShell({ children, minWidth = 148, c }: TooltipShellProps) {
  const style: CSSProperties = {
    background:    c.bg,
    border:        `1px solid ${c.border}`,
    borderRadius:  10,
    boxShadow:     c.shadow,
    padding:       '10px 14px',
    minWidth,
    fontFamily:    'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize:      12,
    lineHeight:    1.5,
    pointerEvents: 'none',
  }
  return <div style={style}>{children}</div>
}

export function TRow({
  label,
  value,
  valueStyle,
  c,
}: {
  label: string
  value: string | number
  valueStyle?: CSSProperties
  c: TooltipColors
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 4 }}>
      <span style={{ color: c.label, fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 12, ...valueStyle }}>{value}</span>
    </div>
  )
}

export function TTitle({ text, c }: { text: string; c: TooltipColors }) {
  return (
    <p style={{ color: c.title, fontWeight: 600, fontSize: 12, marginBottom: 6, marginTop: 0 }}>{text}</p>
  )
}

export function TDivider({ c }: { c: TooltipColors }) {
  return <div style={{ height: 1, background: c.divider, margin: '6px 0' }} />
}
