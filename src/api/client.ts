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

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json() as Promise<T>
}

export async function fetchActivities(): Promise<ActivitiesResponse> {
  return fetchJSON<ActivitiesResponse>(`${BASE}/dim_actividades`)
}

export async function fetchSimulations(): Promise<Simulation[]> {
  const raw = await fetchJSON<SimulationsResponse>(`${BASE}/rol_play_sim_extractor`)
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
