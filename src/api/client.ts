import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  Simulation,
  SimulationsResponse,
} from './types'
import { inDateWindow, resolveEffectiveDates } from '../lib/dateUtils'

const BASE   = '/sanfer/api'
const CLIENT = 'rolplay_sanfer_robin'

const SANFER_IDS = [
  331, 343, 344, 345, 346, 347, 348, 358, 365, 367, 368, 371, 387, 390,
  399, 402, 403, 405, 406, 408, 409, 410, 411, 412, 413, 419, 420, 421,
  422, 423, 428, 430, 432, 433, 434, 435, 436, 439, 440, 445, 446, 447,
  448, 449, 452, 453, 454, 455, 457, 459, 460, 461, 462, 464, 465, 466,
  467, 468, 469, 481, 484, 488, 489, 490, 491, 492, 493,
]

const ID_QS = SANFER_IDS.map((id) => `id=${id}`).join('&')

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
 * Fetches the simulation fact table and applies a 30-day client-side date filter.
 * The upstream API has no date params — filtering here caps the working dataset
 * to ~30 days, cutting payload processing by 80–95% vs loading full history.
 */
export async function fetchSimulations(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<Simulation[]> {
  const raw = await fetchJSON<SimulationsResponse>(
    `${BASE}/rol_play_sim_extractor?${ID_QS}`,
    signal,
  )
  const all: Simulation[] = Array.isArray(raw) ? raw : (raw.data ?? [])

  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)
  return all.filter((s) => {
    const date = s.Fecha_y_Hora?.split('T')[0]
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
