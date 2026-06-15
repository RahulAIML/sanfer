// ─────────────────────────────────────────────────────────────────────────────
// Certificación Sanfer — Junio 2026
// Source of truth: "SImuladores Sanfer Certificación Junio2026.xlsx"
//   Sheet "Plan":        15 líneas · 45 ejercicios · 5 jefes de capacitación
//   Sheet "Asinaciones": línea → 3 simuladores asignados (producto, ID, liga)
//   Sheet "Info BD":     SAEX_IDs verified against roleplay_demorp6
// tagId = LineTag.id from the platform tag1 endpoint (== mb_idTag1 on members)
// ─────────────────────────────────────────────────────────────────────────────

export interface CertSim {
  slot: 1 | 2 | 3
  product: string
  saexId: number
  link: string
}

export interface CertLine {
  tagId: number
  name: string
  jefe: string
  sims: [CertSim, CertSim, CertSim]
}

export const CERT_WINDOW = { from: '2026-06-08', to: '2026-06-22' } as const
export const CERT_TITLE  = 'Certificación Sanfer — Junio 2026'
export const CERT_TOTAL_SLOTS = 45   // 15 líneas × 3 simuladores (ID 420 shared by 2 líneas → 44 unique)
// Minimum score on each assigned simulator to be considered certified.
// Pending CTO confirmation: official platform may use completion-only (0 = any attempt).
// Update this constant — do NOT redefine it in individual pages.
export const CERT_SCORE_BAR = 80

const L = 'https://improveyourpitchbeta.net/demorp6'

export const CERT_LINES: CertLine[] = [
  // ── ENIF ──
  { tagId: 6,  name: 'Minotauros', jefe: 'ENIF', sims: [
    { slot: 1, product: 'Danzen',                 saexId: 464, link: `${L}/e/sanfer_danzen_vf` },
    { slot: 2, product: 'Stadium',                saexId: 436, link: `${L}/e/sanfer_stadium` },
    { slot: 3, product: 'Neuroflax',              saexId: 484, link: `${L}/e/sanfer_neuroflax` },
  ]},
  { tagId: 28, name: 'Proteus', jefe: 'ENIF', sims: [
    { slot: 1, product: 'Amal',                   saexId: 411, link: `${L}/e/sanfer_amal` },
    { slot: 2, product: 'Cervilan',               saexId: 454, link: `${L}/e/sanfer_cervilan` },
    { slot: 3, product: 'Vontrol',                saexId: 481, link: `${L}/e/sanfer_vontrol` },
  ]},
  { tagId: 8,  name: 'Poseidón', jefe: 'ENIF', sims: [
    { slot: 1, product: 'Actron',                 saexId: 489, link: `${L}/index.php?uc=489` },
    { slot: 2, product: 'Microdacyn Bucofaríngeo', saexId: 460, link: `${L}/e/sanfer_microdacyn_bucofaringeo` },
    { slot: 3, product: 'Clavulín Odonto',        saexId: 468, link: `${L}/e/sanfer_clavulin_odonto` },
  ]},
  { tagId: 9,  name: 'Horus', jefe: 'ENIF', sims: [
    { slot: 1, product: 'Patanol',                saexId: 445, link: `${L}/e/sanfer_patanol` },
    { slot: 2, product: 'Vigamoxi',               saexId: 410, link: `${L}/e/sanfer_vigamoxi` },
    { slot: 3, product: 'Travatan',               saexId: 491, link: `${L}/e/sanfer_travatan` },
  ]},
  // ── MIGUEL ANGEL ──
  { tagId: 10, name: 'Cíclopes', jefe: 'MIGUEL ANGEL', sims: [
    { slot: 1, product: 'Zanidip',                saexId: 461, link: `${L}/e/sanfer_zanidip_vf` },
    { slot: 2, product: 'Temerit',                saexId: 402, link: `${L}/e/sanfer_temerit_vf` },
    { slot: 3, product: 'Tritace',                saexId: 432, link: `${L}/e/sanfer_tritace` },
  ]},
  { tagId: 11, name: 'Cronos', jefe: 'MIGUEL ANGEL', sims: [
    { slot: 1, product: 'Daflon',                 saexId: 453, link: `${L}/e/sanfer_daflon_vf` },
    { slot: 2, product: 'Trental',                saexId: 419, link: `${L}/e/sanfer_trental` },
    { slot: 3, product: 'Crisvi',                 saexId: 403, link: `${L}/e/sanfer_crisvi_vf` },
  ]},
  { tagId: 12, name: 'Atlantes', jefe: 'MIGUEL ANGEL', sims: [
    { slot: 1, product: 'Tasedan',                saexId: 465, link: `${L}/e/sanfer_tasedan_vf` },
    { slot: 2, product: 'Afya',                   saexId: 405, link: `${L}/e/sanfer_afyavf` },
    { slot: 3, product: 'Lucebanol',              saexId: 446, link: `${L}/e/sanfer_lucebanol` },
  ]},
  // ── AARÓN ──
  { tagId: 23, name: 'Fenix', jefe: 'AARÓN', sims: [
    { slot: 1, product: 'Vagitrol',               saexId: 420, link: `${L}/e/sanfer_vagitrol_v` },
    { slot: 2, product: 'Asenlix',                saexId: 408, link: `${L}/e/sanfer_asenlix` },
    { slot: 3, product: 'Meta-R',                 saexId: 440, link: `${L}/e/sanfer_metaR` },
  ]},
  { tagId: 5,  name: 'Argonautas', jefe: 'AARÓN', sims: [
    { slot: 1, product: 'Omuro',                  saexId: 428, link: `${L}/e/sanfer_omuro_ac` },
    { slot: 2, product: 'Gamo',                   saexId: 457, link: `${L}/e/sanfer_gamo` },
    { slot: 3, product: 'Solostin',               saexId: 488, link: `${L}/e/sanfer_solostin` },
  ]},
  { tagId: 7,  name: 'Apolos', jefe: 'AARÓN', sims: [
    { slot: 1, product: 'Microdacyn',             saexId: 409, link: `${L}/e/sanfer_microdacyn` },
    { slot: 2, product: 'Cuerpo Amarillo Fuerte', saexId: 449, link: `${L}/e/sanfer_cap_vf` },
    { slot: 3, product: 'Vagitrol',               saexId: 420, link: `${L}/e/sanfer_vagitrol_v` },
  ]},
  // ── CITLALI ──
  { tagId: 1,  name: 'Titanes', jefe: 'CITLALI', sims: [
    { slot: 1, product: 'Clavulin',               saexId: 399, link: `${L}/e/sanfer_clavulin12` },
    { slot: 2, product: 'Amoxibron',              saexId: 490, link: `${L}/e/sanfer_amoxibron` },
    { slot: 3, product: 'Bifebral',               saexId: 390, link: `${L}/e/sanfer_bifebral` },
  ]},
  { tagId: 2,  name: 'Pegasos', jefe: 'CITLALI', sims: [
    { slot: 1, product: 'Posipen',                saexId: 493, link: `${L}/e/sanfer_posipen` },
    { slot: 2, product: 'Pranosine',              saexId: 413, link: `${L}/e/sanfer_pranosine_` },
    { slot: 3, product: 'Cedax',                  saexId: 448, link: `${L}/e/sanfer_cedax` },
  ]},
  { tagId: 3,  name: 'Perseus', jefe: 'CITLALI', sims: [
    { slot: 1, product: 'Hemosin-K',              saexId: 406, link: `${L}/e/sanfer_hemosink_v` },
    { slot: 2, product: 'Azibiot',                saexId: 492, link: `${L}/e/sanfer_azibiot` },
    { slot: 3, product: 'Penamox 12H Duo',        saexId: 455, link: `${L}/e/sanfer_penamox` },
  ]},
  { tagId: 25, name: 'Ares', jefe: 'CITLALI', sims: [
    { slot: 1, product: 'Spectrila',              saexId: 467, link: `${L}/e/sanfer_spectrila` },
    { slot: 2, product: 'Bioyetin',               saexId: 433, link: `${L}/e/sanfer_bioyetin_v` },
    { slot: 3, product: 'Filatil',                saexId: 462, link: `${L}/e/sanfer_filatil` },
  ]},
  // ── HARLEM ──
  { tagId: 24, name: 'Vulcanos', jefe: 'HARLEM', sims: [
    { slot: 1, product: 'Treda',                  saexId: 421, link: `${L}/e/sanfer_treda_vf` },
    { slot: 2, product: 'Oxal',                   saexId: 423, link: `${L}/e/sanfer_oxal_vf` },
    { slot: 3, product: 'Ahlib',                  saexId: 439, link: `${L}/e/sanfer_ahlib` },
  ]},
]

export const CERT_JEFES: string[] = Array.from(new Set(CERT_LINES.map((l) => l.jefe)))
