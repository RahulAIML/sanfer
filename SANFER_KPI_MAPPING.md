# Sanfer Dashboard — KPI Mapping

> Maps every KPI from the Gentera source dashboard to its Sanfer equivalent.  
> Status key: ✅ Preserved · 🔄 Adapted · ➕ New · ❌ Removed

---

## 1. Overview / Summary KPIs

| KPI | Gentera label | Sanfer label | Status | Computation |
|---|---|---|---|---|
| Total Simulations | Total Simulaciones | Total Simulaciones | ✅ | `sims.length` |
| Average Score | Puntaje Promedio | Puntaje Promedio | ✅ | `mean(Calificacion)` across all sims |
| Pass Rate | Tasa Aprobación | Tasa Aprobación | ✅ | `sims where Calificacion >= 60 / total * 100` |
| Active Advisors | Asesores Activos | Asesores Activos | ✅ | `distinct(Usuario) where last sim <= 30 days` |
| Pass Count | Aprobados | Aprobados | ✅ | `count(sims where Calificacion >= 60)` |
| Fail Count | Reprobados | Reprobados | ✅ | `count(sims where Calificacion < 60)` |
| Total Activities | Total Actividades | Total Actividades | ✅ | `activities.length` |
| Total Members | Total Miembros | Total Miembros | ✅ | `members.length` |

**Pass threshold: 60 points** (`PASS_THRESHOLD` constant in `src/lib/analytics.ts`)

---

## 2. Activity-Level KPIs

| KPI | Status | Computation |
|---|---|---|
| Simulations per activity | ✅ | Group sims by `ID_Caso_de_Uso` |
| Average score per activity | ✅ | `mean(Calificacion)` per activity group |
| Pass rate per activity | ✅ | Pass count / sim count per group × 100 |
| Top activity by simulations | ✅ | `max(simCount)` across activity groups |
| Activity coverage (% with sims) | ✅ | Activities with at least 1 sim / total activities |

---

## 3. User/Advisor KPIs

| KPI | Status | Computation |
|---|---|---|
| Score per advisor | ✅ | Group sims by `Usuario`, compute mean `Calificacion` |
| Sim count per advisor | ✅ | `count(sims)` per Usuario |
| Pass rate per advisor | ✅ | Pass count / sim count × 100 per user |
| Score trend (over time) | ✅ | Sort sims by `Fecha_y_Hora`, compute rolling mean |
| Top performer | ✅ | User with highest `avgScore` and >= 1 sim |
| Most improved | ✅ | Largest positive delta between first and last sim score |

---

## 4. Business Lines KPIs (NEW — Sanfer-specific)

| KPI | Status | Source fields | Computation |
|---|---|---|---|
| Total lines | ➕ | `tag1` endpoint | `lines.length` |
| Active lines | ➕ | `tag1` + `sims` | Lines with at least 1 sim |
| Members per line | ➕ | `members.mb_idTag1` | Group members by `mb_idTag1` |
| Simulations per line | ➕ | `members` → `sims` join | Count sims for users in each line |
| Avg score per line | ➕ | Same join | `mean(Calificacion)` per line |
| Pass rate per line | ➕ | Same join | Pass count / sim count × 100 per line |
| Active users per line | ➕ | Same join | `distinct(Usuario)` per line |
| Best performing line | ➕ | Derived | Line with highest `avgScore` among active lines |

**Join path:** `LineTag.tag_id` → `Member.mb_idTag1` → `Member.mb_user` → `Simulation.Usuario`

---

## 5. Trend / Time-Series KPIs

| KPI | Status | Computation |
|---|---|---|
| Daily simulation volume | ✅ | Group sims by `Fecha_y_Hora` date part |
| Weekly rolling average score | ✅ | 7-day window over daily mean scores |
| Cumulative pass rate over time | ✅ | Cumulative sum of passes / cumulative total |
| Score distribution (histogram) | ✅ | Bucket `Calificacion` into 0–20, 21–40, 41–60, 61–80, 81–100 |

---

## 6. Criterion-Level KPIs

| KPI | Status | Notes |
|---|---|---|
| Puntos_1 avg | ✅ | `mean(Puntos_1)` across filtered sims |
| Puntos_2 avg | ✅ | `mean(Puntos_2)` |
| Puntos_3 avg | ✅ | `mean(Puntos_3)` |
| Puntos_4 avg | ✅ | `mean(Puntos_4)` |
| Puntos_5 avg | ✅ | `mean(Puntos_5)` |
| Puntos_6 avg | ✅ | `mean(Puntos_6)` |
| Weakest criterion | ✅ | `argmin(mean(Puntos_i))` — identifies training gap |
| Criterion radar chart | ✅ | All 6 criteria rendered on `RadarChart` component |

---

## 7. KPIs Removed (Roleplay.net exclusive)

| KPI | Reason removed |
|---|---|
| WPM (words per minute) | Requires real-time audio transcription from Roleplay.net |
| Tone score | AI-scored via Roleplay.net facial/voice analysis |
| Clarity score | Same |
| Engagement score | Same |
| Empathy score | Same |
| Rubric criteria scores (rúbrica) | From `Fact_RolPlay_Rub` table — Sanfer has no rubric data |
| Session duration | Roleplay.net session telemetry |
| Supervisor review rate | SupervisorsPage dependency |

---

## 8. Filter Dimensions

| Filter | Status | Source |
|---|---|---|
| Activity (`ID_Caso_de_Uso`) | ✅ | `dim_actividades` |
| Date range (`Fecha_y_Hora`) | ✅ | Simulation timestamp |
| Business Line (`mb_idTag1`) | ➕ | `tag1` dimension (new) |
| Admin / supervisor | ✅ | `administrators` endpoint |

---

## 9. KPI Computation Location

All KPI logic lives in **`src/lib/analytics.ts`** as pure functions — no side effects, no API calls, fully testable:

| Function | Computes |
|---|---|
| `computeKPIs(sims, members)` | Summary KPIs (totalSimulations, averageScore, passRate, etc.) |
| `computeActivityStats(activities, sims)` | Per-activity breakdown |
| `computeUserStats(sims, members)` | Per-advisor leaderboard + trends |
| `computeCriterionStats(sims)` | Puntos_1..6 averages |
| `computeTrend(sims, windowDays)` | Time-series rolling window |
| `computeLineStats(lines, members, sims)` | **NEW** — per-line breakdown (Sanfer) |
