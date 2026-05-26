# Sanfer Dashboard — Migration Analysis

> Schema-adaptation of the Gentera Unified Dashboard to the Sanfer client.  
> Source repo: `RahulAIML/gentera_unified_dashboard_AI_simulators`  
> Target repo: `RahulAIML/sanfer`  
> Migration date: 2026-05-26

---

## 1. Scope

| Area | Gentera | Sanfer | Action |
|---|---|---|---|
| Core simulation analytics | Fact_RolPlay_Sim | Fact_RolPlay_Sim (identical schema) | **Preserved as-is** |
| Activity dimension | `dim_actividades?id=82&id=102&...` | `dim_actividades` (all) | **Endpoint adapted** |
| Member dimension | `data/rolplay_gentera_demo/members` | `data/rolplay_sanfer_robin/members` | **Client slug changed** |
| Admin dimension | `data/rolplay_gentera_demo/administrators` | `data/rolplay_sanfer_robin/administrators` | **Client slug changed** |
| Business Lines (tag1) | Not present | `data/rolplay_sanfer_robin/tag1` | **NEW dimension added** |
| Roleplay.net AI scoring | `/rplay` proxy, rubric data | None | **Removed** |
| Supervisors page | `SupervisorsPage.tsx` | None | **Removed** |
| Roleplay page | `RoleplayPage.tsx` | None | **Removed** |

---

## 2. API Endpoint Catalog

### 2.1 Sanfer Endpoints

| Endpoint | Method | Returns | Used in |
|---|---|---|---|
| `GET /sanfer/api/dim_actividades` | GET | `{ data: Activity[] }` | Activities filter, KPIs |
| `GET /sanfer/api/rol_play_sim_extractor` | GET | `Simulation[]` or `{ data: Simulation[] }` | All analytics |
| `GET /sanfer/api/data/rolplay_sanfer_robin/members` | GET | `{ data: Member[] }` | User/line joins |
| `GET /sanfer/api/data/rolplay_sanfer_robin/administrators` | GET | `{ data: Admin[] }` | Admin filter |
| `GET /sanfer/api/data/rolplay_sanfer_robin/tag1` | GET | `{ client, count, data: LineTag[] }` | Business Lines page |

### 2.2 Proxy Configuration (`vite.config.ts`)

```
/sanfer → https://serv.aux-rolplay.com
```

Rewrite: strips `/sanfer` prefix before forwarding.

### 2.3 Removed Endpoints (Gentera-specific)

| Endpoint | Reason removed |
|---|---|
| `/rplay/...` | Roleplay.net integration — not in Sanfer contract |
| `dim_actividades?id=82&id=102&...` | Replaced by unfiltered endpoint |
| `data/rolplay_gentera_demo/...` | Wrong client slug |

---

## 3. Schema Comparison

### 3.1 `Fact_RolPlay_Sim` — Identical across both clients

| Field | Type | Description |
|---|---|---|
| `ID_Sim` | number | Primary key |
| `Usuario` | string | User identifier (joins to `mb_user` in members) |
| `Usuario_Nombre` | string | Display name |
| `ID_Caso_de_Uso` | number | FK → Activities |
| `Fecha_y_Hora` | string (ISO) | Simulation timestamp |
| `Calificacion` | number | Score 0–100 |
| `Puntos_Totales` | number | Total raw points |
| `Puntos_1`–`Puntos_6` | number | Criterion breakdown |
| `Diagnostico_Final` | string \| null | Narrative diagnosis |

### 3.2 `Member` — Identical, plus new `mb_idTag1` field

| Field | Type | Description |
|---|---|---|
| `mb_user` | string | PK, joins to `Usuario` in sims |
| `mb_name` | string | Display name |
| `mb_email` | string | Email |
| `mb_idTag1` | number \| null | **NEW** — FK to `LineTag.tag_id` |
| `mb_admin` | string \| null | Admin reference |
| `mb_status` | string | Active/inactive |

### 3.3 `LineTag` — New dimension (Sanfer-specific)

| Field | Type | Description |
|---|---|---|
| `tag_id` | number | PK |
| `tag_name` | string | Line display name |
| `tag_description` | string? | Optional description |
| `tag_status` | string? | Active/inactive |
| `tag_color` | string? | Optional color hint |
| `tag_parent` | number \| null | Parent line for hierarchy |

---

## 4. Architecture Changes

### 4.1 Files Deleted

| File | Reason |
|---|---|
| `src/api/roleplayClient.ts` | Roleplay.net HTTP client |
| `src/api/roleplayQueries.ts` | TanStack Query hooks for rubric data |
| `src/api/roleplayTypes.ts` | Rubric/criteria TypeScript types |
| `src/lib/roleplayAnalytics.ts` | RP scoring analytics (WPM, tone, facial) |
| `src/pages/RoleplayPage.tsx` | Full roleplay sessions page |
| `src/pages/SupervisorsPage.tsx` | Supervisor management page |
| `src/components/charts/CriteriaChart.tsx` | Rubric radar chart |
| `src/components/charts/ScoreDimensionRadar.tsx` | Score dimension chart |
| `public/gentera-logo.svg` | Old client logo |

### 4.2 Files Created

| File | Description |
|---|---|
| `src/pages/BusinessLinesPage.tsx` | Full Business Lines analytics page (new) |
| `public/sanfer-logo.svg` | Sanfer branded SVG logo |
| `.gitignore` | Standard Node/.env exclusions |
| `.claude/launch.json` | Claude Code dev server config |

### 4.3 Files Modified

| File | Change summary |
|---|---|
| `src/api/client.ts` | Endpoint URLs → Sanfer, added `fetchLines()` |
| `src/api/types.ts` | Added `LineTag`, `LinesResponse` interfaces |
| `src/api/queries.ts` | Added `useLines()` hook |
| `src/store/index.ts` | Added `selectedLineId` filter state |
| `src/lib/analytics.ts` | Added `computeLineStats()`, updated AI context |
| `src/lib/i18n.ts` | Sanfer branding, new i18n keys for lines |
| `src/App.tsx` | Removed RP/Supervisors routes |
| `src/components/layout/Sidebar.tsx` | Sanfer branding, removed roleplay nav group |
| `src/components/ai/AIAssistant.tsx` | Sanfer prompt, removed RP context |
| `src/pages/OverviewPage.tsx` | Removed RP KPI section |
| `src/pages/ReportsPage.tsx` | Replaced RP CSV export with sim detail export |
| `vite.config.ts` | Port 5174, proxy `/sanfer`, removed `/rplay` |

---

## 5. Risk Areas

| Risk | Severity | Mitigation |
|---|---|---|
| `mb_idTag1` nullable on members | Low | `computeLineStats()` gracefully handles null — members without a line are excluded from line stats |
| API response shape variability | Low | `fetchSimulations()` handles both `Simulation[]` and `{ data: Simulation[] }` shapes |
| Line hierarchy (`tag_parent`) | Medium | Current implementation is flat — hierarchical display deferred to future sprint |
| No date filter on simulations | Low | Date filtering implemented in `useDashboardData()` via `dateFrom`/`dateTo` store state |
| GEMINI_API_KEY missing at build time | Low | AI assistant degrades gracefully with error message; non-blocking |

---

## 6. Build Verification

```
tsc --noEmit       → 0 errors, 0 warnings
npm run build      → ✅ Success
  dist/index.html
  dist/assets/index-[hash].js   ~1017 kB (gzipped ~295 kB)
  dist/assets/index-[hash].css  ~32 kB
```

---

## 7. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GEMINI_API_KEY` | Yes | Google Gemini API key for AI assistant |
| `VITE_GEMINI_MODEL` | No | Defaults to `gemini-2.0-flash` |

See `.env.example` for template.
