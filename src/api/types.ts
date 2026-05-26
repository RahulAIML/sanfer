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
  current_page: number
  data: Activity[]
  page_size: number
  total_pages: number
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
  Puntos_1: number | string | null
  Puntos_2: number | string | null
  Puntos_3: number | string | null
  Puntos_4: number | string | null
  Puntos_5: number | string | null
  Puntos_Totales: number
  Respuesta_1: string | null
  Respuesta_2: string | null
  Respuesta_3: string | null
  Respuesta_4: string | null
  Respuesta_5: string | null
  Retroalimentacion_1: string | null
  Retroalimentacion_2: string | null
  Retroalimentacion_3: string | null
  Retroalimentacion_4: string | null
  Retroalimentacion_5: string | null
  Usuario: string | null
  Usuario_Nombre: string | null
}

export type SimulationsResponse = Simulation[] | { data: Simulation[]; total_records?: number }

// ─────────────────────────────────────────────
// DIM_USERDIST (members)
// ─────────────────────────────────────────────
export interface Member {
  mb_id: number
  mb_fullname: string
  mb_email: string
  mb_employee_code: string
  mb_admin: number
  mb_status: number          // 1 = active, 0 = inactive
  mb_date_create: string
  mb_last_login: string | null
  mb_designation: string
  mb_branch: string
  mb_city: string
  mb_country: string
  mb_ruta: string
  mb_line: string
  mb_state: string
  mb_user: string
  mb_reference: string | null
  mb_idDepartament: number
  mb_idTag1: number          // 0 = no line assigned; maps to LineTag.id
  mb_idTag2: number
  mb_idTag3: number
  mb_group: number
  mb_headquarters: string
  mb_special_group: number
  mb_user_token: string
}

export interface MembersResponse {
  client: string
  count: number
  data: Member[]
}

// ─────────────────────────────────────────────
// DIM_ADMIN (administrators)
// ─────────────────────────────────────────────
export type ProfileType = 'dev' | 'tenant' | 'supervisor' | 'admin' | 'enradmin'

export interface Administrator {
  rpa_id: number
  rpa_full_name: string
  rpa_email: string
  rpa_profile_type: ProfileType
  rpa_parent: number
  rpa_sede: string
  rpa_user: string
  rpa_company: string
  rpa_create_date: string
  rpa_mod_admin: boolean
  rpa_mod_creator: boolean
  rpa_mod_doedit: boolean
  rpa_is_demo: boolean
  rp_assoc_tenant: number
}

export interface AdminsResponse {
  client: string
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
