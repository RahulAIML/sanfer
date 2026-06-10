import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  Simulation,
  SimulationsResponse,
} from './types'
import { inDateWindow, resolveEffectiveDates } from '../lib/dateUtils'

const BASE        = '/sanfer/api'
const BRIDGE_BASE = '/sanfer/bridge'
const CLIENT      = 'rolplay_sanfer_robin'

// All 67 exercise use-case IDs — used for dim_actividades (activities metadata)
const SANFER_IDS = [
  331, 343, 344, 345, 346, 347, 348, 358, 365, 367, 368, 371, 387, 390,
  399, 402, 403, 405, 406, 408, 409, 410, 411, 412, 413, 419, 420, 421,
  422, 423, 428, 430, 432, 433, 434, 435, 436, 439, 440, 445, 446, 447,
  448, 449, 452, 453, 454, 455, 457, 459, 460, 461, 462, 464, 465, 466,
  467, 468, 469, 481, 484, 488, 489, 490, 491, 492, 493,
]

// 44 certification exercise IDs served via the demorp6 PHP bridge (Source 2)
const DEMORP6_IDS = [
  390, 399, 402, 403, 405, 406, 408, 409, 410, 411, 413, 419, 420, 421,
  423, 428, 432, 433, 436, 439, 440, 445, 446, 448, 449, 453, 454, 455,
  457, 460, 461, 462, 464, 465, 467, 468, 481, 484, 488, 489, 490, 491,
  492, 493,
]

// 23 legacy IDs not in the certification set — served via existing extractor (Source 1)
const SANFER_SIM_IDS = SANFER_IDS.filter((id) => !DEMORP6_IDS.includes(id))

const ID_QS         = SANFER_IDS.map((id) => `id=${id}`).join('&')
const LEGACY_SIM_QS = SANFER_SIM_IDS.map((id) => `id=${id}`).join('&')

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

export async function fetchActivities(signal?: AbortSignal): Promise<ActivitiesResponse> {
  return fetchJSON<ActivitiesResponse>(`${BASE}/dim_actividades?${ID_QS}`, signal)
}

/**
 * Dual-source simulation fetch:
 *   Source 1 — existing Python extractor for 23 legacy use-case IDs
 *   Source 2 — PHP bridge (demorp6 direct) for 44 certification use-case IDs,
 *              filtered to saex_rp_client='sanfer' with correct Diagnostico_Final
 *
 * Dates from Source 1 are T-separated (Python ISO); Source 2 uses space-separated
 * (MySQL raw). simDate() handles both via substring(0,10).
 */
export async function fetchSimulations(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<Simulation[]> {
  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)

  const bridgeQS = `action=sim.demorp6&ids=${DEMORP6_IDS.join(',')}&date_from=${effFrom}&date_to=${effTo}`

  const [srcA, srcB] = await Promise.allSettled([
    fetchJSON<SimulationsResponse>(`${BASE}/rol_play_sim_extractor?${LEGACY_SIM_QS}`, signal),
    fetchJSON<{ ok: boolean; data: Simulation[] }>(`${BRIDGE_BASE}/?${bridgeQS}`, signal),
  ])

  const simsA: Simulation[] = srcA.status === 'fulfilled'
    ? (Array.isArray(srcA.value) ? srcA.value : (srcA.value.data ?? []))
    : []

  const simsB: Simulation[] = srcB.status === 'fulfilled'
    ? (srcB.value.data ?? [])
    : []

  // Merge — Source B (demorp6 bridge) takes precedence for shared ID_Sim values
  const byId = new Map<number, Simulation>()
  for (const s of simsA) byId.set(s.ID_Sim, s)
  for (const s of simsB) byId.set(s.ID_Sim, s)

  return Array.from(byId.values()).filter((s) => {
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
