import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import type { ActivityStat } from '../../lib/analytics'
import type { Language } from '../../store'
import { useChartColors } from '../../lib/chartTheme'
import { TooltipShell, TTitle, TRow, TDivider, useTooltipColors, type TooltipColors } from './TooltipShell'

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EF4444']

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: ActivityStat }>
  language: Language
  c: TooltipColors
}

function CustomTooltip({ active, payload, language, c }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell minWidth={192} c={c}>
      <TTitle text={d.name} c={c} />
      <TDivider c={c} />
      <TRow label={language === 'es' ? 'Sesiones' : 'Sessions'}
            value={d.count}
            valueStyle={{ color: c.value }}
            c={c} />
      <TRow label={language === 'es' ? 'Prom. Puntaje' : 'Avg Score'}
            value={`${d.avgScore}%`}
            valueStyle={{ color: c.accent }}
            c={c} />
      <TRow label={language === 'es' ? 'Tasa Aprob.' : 'Pass Rate'}
            value={`${d.passRate}%`}
            valueStyle={{ color: c.success }}
            c={c} />
    </TooltipShell>
  )
}

interface Props {
  data: ActivityStat[]
  language: Language
  metric?: 'count' | 'avgScore' | 'passRate'
  height?: number
}

export function ActivityBar({ data, language, metric = 'avgScore', height = 200 }: Props) {
  const c = useChartColors()
  const tt = useTooltipColors()

  const shortName = (name: string) => {
    if (name.length <= 18) return name
    return name.slice(0, 16) + '…'
  }

  const formatted = data.map((d) => ({
    ...d,
    shortName: shortName(d.name),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={formatted}
        layout="vertical"
        margin={{ top: 4, right: 48, left: 8, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={metric === 'count' ? [0, 'dataMax'] : [0, 100]}
          tick={{ fontSize: 11, fill: c.tick }}
          axisLine={false}
          tickLine={false}
          tickFormatter={metric !== 'count' ? (v) => `${v}%` : undefined}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          width={130}
          tick={{ fontSize: 11, fill: c.tick }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip language={language} c={tt} />}
          cursor={{ fill: c.cursorFill }}
          wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
        <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey={metric}
            position="right"
            formatter={(v: number) => metric !== 'count' ? `${v}%` : v}
            style={{ fill: c.labelList, fontSize: 11 }}
          />
          {formatted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
