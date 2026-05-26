import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  Simulation,
  SimulationsResponse,
} from './types'

const BASE = '/sanfer/api'
const CLIENT = 'rolplay_sanfer_robin'

// Activity IDs that belong to the Sanfer client (discovered by API scan)
const SANFER_IDS = [
  331, 343, 344, 345, 346, 347, 348, 358, 365, 367, 368, 371, 387, 390,
  399, 402, 403, 405, 406, 408, 409, 410, 411, 412, 413, 419, 420, 421,
  422, 423, 428, 430, 432, 433, 434, 435, 436, 439, 440, 445, 446, 447,
  448, 449, 452, 453, 454, 455, 457, 459, 460, 461, 462, 464, 465, 466,
  467, 468, 469, 481, 484, 488, 489, 490, 491, 492, 493,
]
const ID_QS = SANFER_IDS.map((id) => `id=${id}`).join('&')

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json() as Promise<T>
}

export async function fetchActivities(): Promise<ActivitiesResponse> {
  return fetchJSON<ActivitiesResponse>(`${BASE}/dim_actividades?${ID_QS}`)
}

export async function fetchSimulations(): Promise<Simulation[]> {
  const raw = await fetchJSON<SimulationsResponse>(`${BASE}/rol_play_sim_extractor?${ID_QS}`)
  if (Array.isArray(raw)) return raw
  if ('data' in raw && Array.isArray(raw.data)) return raw.data
  return []
}

export async function fetchMembers(): Promise<MembersResponse> {
  return fetchJSON<MembersResponse>(`${BASE}/data/${CLIENT}/members`)
}

export async function fetchAdmins(): Promise<AdminsResponse> {
  return fetchJSON<AdminsResponse>(`${BASE}/data/${CLIENT}/administrators`)
}

export async function fetchLines(): Promise<LinesResponse> {
  return fetchJSON<LinesResponse>(`${BASE}/data/${CLIENT}/tag1`)
}
