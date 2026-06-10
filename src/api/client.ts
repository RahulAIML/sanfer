import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  Simulation,
} from './types'
import { inDateWindow, resolveEffectiveDates } from '../lib/dateUtils'

const BASE        = '/sanfer/api'
const BRIDGE_BASE = '/sanfer/bridge'
const CLIENT      = 'rolplay_sanfer_robin'

// 44 unique certification exercise IDs (June 2026 Excel — 15 per simulator × 3 simulators;
// ID 420 appears in Sim 1 and Sim 3, giving 45 slots but 44 unique values).
const SANFER_IDS = [
  390, 399, 402, 403, 405, 406, 408, 409, 410, 411, 413, 419, 420, 421,
  423, 428, 432, 433, 436, 439, 440, 445, 446, 448, 449, 453, 454, 455,
  457, 460, 461, 462, 464, 465, 467, 468, 481, 484, 488, 489, 490, 491,
  492, 493,
]

const IDS_CSV = SANFER_IDS.join(',')

/** Extract YYYY-MM-DD from a date string regardless of T or space separator. */
export function simDate(fecha: string | null | undefined): string {
  return fecha?.substring(0, 10) ?? ''
}

// ─────────────────────────────────────────────
// Core fetch utility
// ─────────────────────────────────────────────

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────

// Activity names come from the bridge (demorp6 usecases table) — the single
// source of truth for the 44 certification exercises.
export async function fetchActivities(signal?: AbortSignal): Promise<ActivitiesResponse> {
  return fetchJSON<ActivitiesResponse>(`${BRIDGE_BASE}/?action=activities.demorp6&ids=${IDS_CSV}`, signal)
}

export async function fetchSimulations(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<Simulation[]> {
  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)
  const qs = `action=sim.demorp6&ids=${IDS_CSV}&date_from=${effFrom}&date_to=${effTo}`
  const resp = await fetchJSON<{ ok: boolean; data: Simulation[] }>(`${BRIDGE_BASE}/?${qs}`, signal)
  return (resp.data ?? []).filter((s) => {
    const date = simDate(s.Fecha_y_Hora)
    return date ? inDateWindow(date, effFrom, effTo) : false
  })
}

export async function fetchMembers(signal?: AbortSignal): Promise<MembersResponse> {
  return fetchJSON<MembersResponse>(`${BASE}/data/${CLIENT}/members`, signal)
}

export async function fetchAdmins(signal?: AbortSignal): Promise<AdminsResponse> {
  return fetchJSON<AdminsResponse>(`${BASE}/data/${CLIENT}/administrators`, signal)
}

export async function fetchLines(signal?: AbortSignal): Promise<LinesResponse> {
  return fetchJSON<LinesResponse>(`${BASE}/data/${CLIENT}/tag1`, signal)
}
