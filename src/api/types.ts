// ─────────────────────────────────────────────
// DIM_ACTIVIDADES
// ─────────────────────────────────────────────
export interface Activity {
  Actividad_Nombre: string
  Caso_de_Uso: string
  ID_Caso_de_Uso: number
  Criterio1?: string
  Criterio2?: string
  Criterio3?: string
  Criterio4?: string
  Criterio5?: string
}

export interface ActivitiesResponse {
  ok: boolean
  data: Activity[]
  total_records: number
}

// ─────────────────────────────────────────────
// FACT_ROLPLAY_SIM
// ─────────────────────────────────────────────
export interface Simulation {
  Calificacion: number
  Diagnostico_Final: string | null  // lowercase 'si' / 'no' from API
  Fecha_y_Hora: string
  ID_Caso_de_Uso: number
  ID_Sim: number
  Pregunta_1: string | null
  Pregunta_2: string | null
  Pregunta_3: string | null
  Pregunta_4: string | null
  Pregunta_5: string | null
  Pregunta_6: string | null     // round 6 = closing exchange, never scored
  Puntos_1: number | string | null   // rounds 1–5 scored 0 or 1 (validated vs demorp6)
  Puntos_2: number | string | null
  Puntos_3: number | string | null
  Puntos_4: number | string | null
  Puntos_5: number | string | null
  Puntos_6: number | string | null   // always "No aplica" in practice
  Puntos_Totales: number             // scoreData.sum — 0..5
  Respuesta_1: string | null
  Respuesta_2: string | null
  Respuesta_3: string | null
  Respuesta_4: string | null
  Respuesta_5: string | null
  Respuesta_6: string | null
  Retroalimentacion_1: string | null
  Retroalimentacion_2: string | null
  Retroalimentacion_3: string | null
  Retroalimentacion_4: string | null
  Retroalimentacion_5: string | null
  Retroalimentacion_6: string | null
  Usuario: string | null
  Usuario_Nombre: string | null
}

export type SimulationsResponse = Simulation[] | { data: Simulation[]; total_records?: number }

// ─────────────────────────────────────────────
// Per-session closing report (bridge action=sim.report)
// ─────────────────────────────────────────────
export interface SimReportSection {
  q: string
  a: string   // multi-line answers use \n separators
}

export interface SimRonda {
  n: number
  pregunta: string | null
  respuesta_rep: string | null
  criterio: string
  respuesta_modelo: string
  analisis: string
  puntos: number | null   // 0 or 1; null = unscored (round 6 or missing)
  max_puntos: number
}

export interface SimReport {
  ID_Sim: number
  ID_Caso_de_Uso: number
  Usuario: string | null
  Usuario_Nombre: string | null
  Fecha_y_Hora: string | null
  Calificacion: number
  Producto: string          // simulator/product name from usecases table
  Titulo: string
  Rondas: SimRonda[]        // parsed interaction rounds 1–5
  Secciones: SimReportSection[]
}

// ─────────────────────────────────────────────
// DIM_USERDIST (members)
// ─────────────────────────────────────────────
// Served by the bridge org.members proxy — only the fields the dashboard
// reads (the raw platform endpoint ships ~25 fields incl. user tokens).
export interface Member {
  mb_id: number
  mb_fullname: string
  mb_email: string
  mb_user: string
  mb_admin: number
  mb_status: number          // 1 = active, 0 = inactive
  mb_designation: string
  mb_idTag1: number          // 0 = no line assigned; maps to LineTag.id
}

export interface MembersResponse {
  ok?: boolean
  count: number
  data: Member[]
}

// ─────────────────────────────────────────────
// DIM_ADMIN (administrators)
// ─────────────────────────────────────────────
export type ProfileType = 'dev' | 'tenant' | 'supervisor' | 'admin' | 'enradmin'

// Served by the bridge org.admins proxy — trimmed to the fields in use.
export interface Administrator {
  rpa_id: number
  rpa_full_name: string
  rpa_email: string
  rpa_profile_type: ProfileType
  rpa_parent: number
}

export interface AdminsResponse {
  ok?: boolean
  count: number
  data: Administrator[]
}

// ─────────────────────────────────────────────
// DIM_LINE (tag1) — Sanfer-specific
// ─────────────────────────────────────────────
export interface LineTag {
  id: number
  name: string
  description: string
  idStatus: number   // 1 = active
}

export interface LinesResponse {
  client: string
  count: number
  data: LineTag[]
  database?: string
  table?: string
}

// ─────────────────────────────────────────────
// Objection handling stats (bridge action=objections.demorp6)
// ─────────────────────────────────────────────
export interface ObjectionStat {
  usecase_id: number
  objection_text: string
  count: number         // sessions where this objection appeared
  pass_count: number    // sessions where rep scored 1 on it
  pass_rate: number     // pass_count / scored × 100 (rounded int)
  model_answer?: string // ideal response extracted from retroPrompt
  top_answers?: { text: string; name: string }[] // up to 3 diverse real rep responses
}

export interface ObjectionsResponse {
  ok: boolean
  data: ObjectionStat[]
  total_records: number
}

// ─────────────────────────────────────────────
// Top simulator all-time stats (bridge action=sim.topstats)
// ─────────────────────────────────────────────
export interface TopStatsUser {
  email:     string
  nombre:    string
  avg_best:  number
  sims_done: number
  sims_ge80: number
}

export interface TopStatsAggregate {
  total_records:  number
  avg_best_score: number
  records_ge80:   number
  unique_sims:    number
  unique_users:   number
}

export interface TopStatsResponse {
  ok:        boolean
  stats:     TopStatsAggregate
  top_users: TopStatsUser[]
}

// ─────────────────────────────────────────────
// Per-user cert row (bridge action=org.certification)
// ─────────────────────────────────────────────
export interface CertRow {
  mb_user:     string        // lowercase email
  nombre:      string | null // full name
  empleado:    string | null // employee reference number
  ruta:        string | null // route code
  profile_id:  number        // bhl_id = line tagId in official DB
  finalized:   0 | 1        // 1 = all 3 phases done
  fase1:       0 | 1
  fase1_score: number | null
  fase2:       0 | 1
  fase2_score: number | null
  fase3:       0 | 1
  fase3_score: number | null
}

export interface CertificationResponse {
  ok:      boolean
  cached?: boolean
  count:   number
  data:    CertRow[]
  stats:   CertStats
}

// ─────────────────────────────────────────────
// Cert aggregate stats (bridge action=cert.stats)
// ─────────────────────────────────────────────
export interface CertStats {
  ok:        boolean
  cached?:   boolean
  total:     number   // cert-line members from rolePlay_sanfer_v3 (matches official platform)
  certified: number   // members with fase1=fase2=fase3=1
  completed: number   // sum of fase1+fase2+fase3 across all members
  expected:  number   // total × 3
  pct:       number   // completed/expected %
  cert_pct:  number   // certified/total %
}
