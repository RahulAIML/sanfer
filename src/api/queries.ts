import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchActivities, fetchAdmins, fetchLines, fetchMembers, fetchSimulations } from './client'

// ─────────────────────────────────────────────
// Stale-time constants — tuned per data volatility
// ─────────────────────────────────────────────
const STALE = {
  /** Live session data — refetch every 5 min */
  simulations:  1_000 * 60 * 5,
  /** Activity metadata is nearly static — cache for 24 hrs */
  activities:   1_000 * 60 * 60 * 24,
  /** Org structure / member list changes infrequently — 2 hr */
  org:          1_000 * 60 * 120,
  /** Business line catalog — 2 hr */
  lines:        1_000 * 60 * 120,
} as const

// GC times — how long data stays in memory after all subscribers unmount
const GC = {
  simulations:  1_000 * 60 * 15,
  activities:   1_000 * 60 * 60 * 48,
  org:          1_000 * 60 * 240,
  lines:        1_000 * 60 * 240,
} as const

// ─────────────────────────────────────────────
// Query hooks
// ─────────────────────────────────────────────

/**
 * Simulations fact table, pre-filtered to last 30 days.
 * `keepPreviousData` prevents a blank flash when the date range changes.
 *
 * TODO: Wire `dateFrom`/`dateTo` from the global filter store into the
 * queryKey and queryFn when the date range UI is made global.
 */
export function useSimulations() {
  return useQuery({
    queryKey:        ['simulations'],
    queryFn:         ({ signal }) => fetchSimulations(null, null, signal),
    staleTime:       STALE.simulations,
    gcTime:          GC.simulations,
    placeholderData: keepPreviousData,
  })
}

/** Activity metadata — nearly static, cached for 24 hours */
export function useActivities() {
  return useQuery({
    queryKey:  ['activities'],
    queryFn:   ({ signal }) => fetchActivities(signal),
    staleTime: STALE.activities,
    gcTime:    GC.activities,
    select:    (res) => res.data,
  })
}

/** Full member list — org structure changes infrequently */
export function useMembers() {
  return useQuery({
    queryKey:  ['members'],
    queryFn:   ({ signal }) => fetchMembers(signal),
    staleTime: STALE.org,
    gcTime:    GC.org,
    select:    (res) => res.data,
  })
}

/** Administrator list — org structure changes infrequently */
export function useAdmins() {
  return useQuery({
    queryKey:  ['admins'],
    queryFn:   ({ signal }) => fetchAdmins(signal),
    staleTime: STALE.org,
    gcTime:    GC.org,
    select:    (res) => res.data,
  })
}

/**
 * Business line catalog.
 * Only fetched when the hook is used — BusinessLinesPage is the sole consumer,
 * so this is effectively lazy (not loaded on other pages).
 */
export function useLines() {
  return useQuery({
    queryKey:  ['lines'],
    queryFn:   ({ signal }) => fetchLines(signal),
    staleTime: STALE.lines,
    gcTime:    GC.lines,
    select:    (res) => res.data,
  })
}

/** Convenience aggregate for pages that need all core data */
export function useAllData() {
  const sims       = useSimulations()
  const activities = useActivities()
  const members    = useMembers()
  const admins     = useAdmins()

  return {
    sims:       sims.data      ?? [],
    activities: activities.data ?? [],
    members:    members.data   ?? [],
    admins:     admins.data    ?? [],
    isLoading:  sims.isLoading || activities.isLoading || members.isLoading || admins.isLoading,
    isError:    sims.isError   || activities.isError   || members.isError   || admins.isError,
    error:      sims.error     ?? activities.error     ?? members.error     ?? admins.error,
  }
}
