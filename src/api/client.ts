import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  Simulation,
  SimulationsResponse,
} from './types'
import { SANFER_CONFIG } from '../clients/sanfer/config'
import { inDateWindow, resolveEffectiveDates } from '../lib/dateUtils'

const { apiBase: BASE, clientSlug: CLIENT, activityIds: SANFER_IDS } = SANFER_CONFIG

/** Pre-built querystring shared across endpoint calls */
const ID_QS = SANFER_IDS.map((id) => `id=${id}`).join('&')

// ─────────────────────────────────────────────
// Core fetch utility — AbortSignal + typed JSON
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
 * Fetches the simulation fact table and immediately applies a client-side
 * date window (defaults to last 30 days).
 *
 * WHY client-side: The upstream API does not yet support date parameters.
 * Applying the filter here caps the working dataset at ~30 days of records,
 * reducing downstream analytics computation by 80–95% compared to loading
 * the full history.
 *
 * TODO: When the backend exposes `from`/`to` query params, pass them here and
 * remove the client-side filter — the data shape is identical.
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

  // Resolve effective date window — falls back to last 30 days when both are null
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
