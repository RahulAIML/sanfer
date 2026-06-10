/** Default rolling window for dashboard data */
export const DEFAULT_WINDOW_DAYS = 30

/** Earliest simulation data in demorp6 (first sanfer session: 2025-09-11) */
export const DATA_EPOCH = '2025-09-01'

/** Returns the last N-day range as ISO date strings (YYYY-MM-DD) */
export function getDefaultDateRange(days = DEFAULT_WINDOW_DAYS): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - days)
  const from = fromDate.toISOString().split('T')[0]
  return { from, to }
}

/**
 * Resolves effective dates.
 * If both are null → falls back to the last 30-day window.
 */
export function resolveEffectiveDates(
  from: string | null,
  to: string | null,
): { from: string; to: string } {
  if (!from && !to) return getDefaultDateRange()
  const def = getDefaultDateRange()
  return {
    from: from ?? def.from,
    to:   to   ?? def.to,
  }
}

/** True when a YYYY-MM-DD string is within [from, to] inclusive */
export function inDateWindow(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}
