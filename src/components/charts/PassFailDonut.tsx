import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Language } from '../../store'
import { useAppStore } from '../../store'
import { TooltipShell, TRow, useTooltipColors, type TooltipColors } from './TooltipShell'

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  c: TooltipColors
}

function CustomTooltip({ active, payload, c }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const isPass = payload[0].name === 'Passed' || payload[0].name === 'Aprobado'
  return (
    <TooltipShell minWidth={132} c={c}>
      <TRow label={payload[0].name}
            value={payload[0].value}
            valueStyle={{ color: isPass ? c.success : '#f87171' }}
            c={c} />
    </TooltipShell>
  )
}

interface Props {
  pass: number
  fail: number
  language: Language
  size?: number
}

export function PassFailDonut({ pass, fail, language, size = 180 }: Props) {
  const theme = useAppStore((s) => s.theme)
  const tt = useTooltipColors()
  const isDark = theme === 'dark'
  const total = pass + fail
  const rate = total ? Math.round((pass / total) * 100) : 0
  const passLabel = language === 'es' ? 'Aprobado' : 'Passed'
  const failLabel = language === 'es' ? 'Reprobado' : 'Failed'

  const data = [
    { name: passLabel, value: pass },
    { name: failLabel, value: fail },
  ]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.33}
              outerRadius={size * 0.45}
              startAngle={90}
              endAngle={-270}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              <Cell fill="#10B981" />
              <Cell fill="#EF4444" />
            </Pie>
            <Tooltip
              content={<CustomTooltip c={tt} />}
              wrapperStyle={{ zIndex: 50, outline: 'none' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-2xl font-bold"
            style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
          >{rate}%</span>
          <span
            className="text-xs"
            style={{ color: isDark ? '#94a3b8' : '#475569' }}
          >{passLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span style={{ color: isDark ? '#94a3b8' : '#475569' }}>{passLabel}</span>
          <span className="font-medium" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{pass}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-danger" />
          <span style={{ color: isDark ? '#94a3b8' : '#475569' }}>{failLabel}</span>
          <span className="font-medium" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{fail}</span>
        </div>
      </div>
    </div>
  )
}
