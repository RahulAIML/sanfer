import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ScoreBucket } from '../../lib/analytics'
import { PASS_THRESHOLD } from '../../lib/analytics'
import type { Language } from '../../store'
import { useChartColors } from '../../lib/chartTheme'
import { TooltipShell, TTitle, TRow, useTooltipColors, type TooltipColors } from './TooltipShell'

const BAR_COLOR = (bucket: ScoreBucket) => {
  if (bucket.max <= PASS_THRESHOLD) return '#EF4444'
  return '#3B82F6'
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: ScoreBucket }>
  language: Language
  c: TooltipColors
}

function CustomTooltip({ active, payload, language, c }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const isPassing = d.payload.max > PASS_THRESHOLD
  return (
    <TooltipShell minWidth={148} c={c}>
      <TTitle text={d.payload.label} c={c} />
      <TRow label={language === 'es' ? 'Simulaciones' : 'Simulations'}
            value={d.value}
            valueStyle={{ color: isPassing ? c.accent : '#f87171' }}
            c={c} />
    </TooltipShell>
  )
}

interface Props {
  data: ScoreBucket[]
  language: Language
  height?: number
}

export function ScoreHistogram({ data, language, height = 200 }: Props) {
  const c = useChartColors()
  const tt = useTooltipColors()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: c.tick }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: c.tick }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip language={language} c={tt} />}
          cursor={{ fill: c.cursorFill }}
          wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={BAR_COLOR(entry)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
