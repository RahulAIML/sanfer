import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RoundStat } from '../../lib/analytics'
import type { Language } from '../../store'
import { useChartColors } from '../../lib/chartTheme'
import { TooltipShell, TTitle, TRow, useTooltipColors, type TooltipColors } from './TooltipShell'

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: RoundStat }>
  language: Language
  c: TooltipColors
}

function CustomTooltip({ active, payload, language, c }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell minWidth={144} c={c}>
      <TTitle text={`${language === 'es' ? 'Interacción' : 'Interaction'} ${d.payload.round}`} c={c} />
      <TRow label={language === 'es' ? 'Promedio' : 'Average'}
            value={d.value.toFixed(2)}
            valueStyle={{ color: c.accent }}
            c={c} />
      <TRow label={language === 'es' ? 'Sesiones' : 'Sessions'}
            value={d.payload.count}
            valueStyle={{ color: c.value }}
            c={c} />
    </TooltipShell>
  )
}

interface Props {
  data: RoundStat[]
  language: Language
  height?: number
}

export function RoundRadar({ data, language, height = 260 }: Props) {
  const c = useChartColors()
  const tt = useTooltipColors()
  const radarData = data.map((d) => ({
    ...d,
    fullMark: 1,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <PolarGrid />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: c.tick }}
        />
        <Tooltip
          content={<CustomTooltip language={language} c={tt} />}
          wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
        <Radar
          name={language === 'es' ? 'Promedio' : 'Average'}
          dataKey="avg"
          stroke="#3B82F6"
          strokeWidth={2}
          fill="url(#radarGrad)"
          dot={{ fill: '#3B82F6', strokeWidth: 0, r: 3 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
