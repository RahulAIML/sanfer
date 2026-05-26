import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { TrendPoint } from '../../lib/analytics'
import { PASS_THRESHOLD } from '../../lib/analytics'
import type { Language } from '../../store'
import { useChartColors } from '../../lib/chartTheme'
import { TooltipShell, TTitle, TRow, TDivider, useTooltipColors, type TooltipColors } from './TooltipShell'

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: TrendPoint }>
  label?: string
  language: Language
  c: TooltipColors
}

function CustomTooltip({ active, payload, label, language, c }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const locale = language === 'es' ? es : enUS

  let formatted = label ?? ''
  try {
    formatted = format(parseISO(label ?? ''), 'dd MMM yyyy', { locale })
  } catch {}

  return (
    <TooltipShell minWidth={160} c={c}>
      <TTitle text={formatted} c={c} />
      <TDivider c={c} />
      <TRow label={language === 'es' ? 'Puntaje' : 'Score'}
            value={`${d.value}%`}
            valueStyle={{ color: c.accent }}
            c={c} />
      <TRow label={language === 'es' ? 'Sesiones' : 'Sessions'}
            value={d.payload.count}
            valueStyle={{ color: c.value }}
            c={c} />
      <TRow label={language === 'es' ? 'Aprobación' : 'Pass Rate'}
            value={`${d.payload.passRate}%`}
            valueStyle={{ color: c.success }}
            c={c} />
    </TooltipShell>
  )
}

interface Props {
  data: TrendPoint[]
  language: Language
  height?: number
}

export function TrendChart({ data, language, height = 260 }: Props) {
  const locale = language === 'es' ? es : enUS
  const c = useChartColors()
  const tt = useTooltipColors()

  const formatted = data.map((d) => ({
    ...d,
    label: (() => {
      try {
        return format(parseISO(d.date), 'dd MMM', { locale })
      } catch {
        return d.date
      }
    })(),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: c.tick }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: c.tick }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <ReferenceLine
          y={PASS_THRESHOLD}
          stroke="#10B981"
          strokeDasharray="4 4"
          strokeOpacity={0.4}
          label={{
            value: language === 'es' ? 'Mínimo' : 'Pass',
            position: 'insideTopRight',
            fontSize: 10,
            fill: '#10B981',
            opacity: 0.7,
          }}
        />
        <Tooltip
          content={<CustomTooltip language={language} c={tt} />}
          cursor={{ stroke: c.cursorStroke, strokeWidth: 1.5 }}
          wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
        <Area
          type="monotone"
          dataKey="avgScore"
          stroke="#3B82F6"
          strokeWidth={2.5}
          fill="url(#scoreGrad)"
          dot={{ fill: '#3B82F6', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 6, fill: '#3B82F6', stroke: c.dotStroke, strokeWidth: 2.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
