# KPI AGGREGATION STRATEGY
**Sanfer Analytics Platform — Aggregation & Caching Specification**
**Date:** 2026-05-27

---

## OVERVIEW

This document maps every KPI and derived metric currently computed by the frontend,
identifies its source, its current processing cost, and specifies the target architecture:
what should be pre-aggregated, what should be lazily loaded, what should be cached and
for how long.

**Design principle:**
> The frontend should receive numbers, not data. Shape data on the server (or in a
> dedicated aggregation layer); render it on the client.

---

## CURRENT vs TARGET COMPUTATION MODEL

### Current Model (BAD)
```
Raw API → 5–25 MB JSON → Browser → Synchronous JS Loops → KPIs displayed
```

### Target Model (GOOD)
```
Aggregation Layer → <5 KB summary JSON → Browser → Direct render
Raw API → (only on drilldown demand) → Browser → Virtualized display
```

---

## KPI INVENTORY AND MIGRATION PLAN

---

### KPI-01: Total Simulations

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `sims.length` after full payload | Pre-aggregated by server |
| **Computation** | `Array.length` (trivial) | Backend `COUNT(*)` |
| **Where computed** | `computeKPIs()` in every hook instance | Aggregation endpoint |
| **Cache TTL** | 5 min (stale-time shared with raw data) | 30 min (summary endpoint) |
| **Lazy-loadable** | No — hero KPI, must be instant | No |
| **Optimization** | Move to `GET /api/summary?from=&to=` | Included in summary response |

---

### KPI-02: Average Score

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `sims.map(s => s.Calificacion)` → average | Backend `AVG(Calificacion)` |
| **Computation** | O(N) map + reduce on full dataset | O(1) server-side |
| **Precision** | `Math.round(...)` | Rounded on server, e.g. `74.3` |
| **Filter behavior** | Full re-scan when date filter changes | Pass `from`/`to` as query params |
| **Cache TTL** | 5 min | 15 min (scores don't change retroactively) |
| **Lazy-loadable** | No — hero KPI | No |

---

### KPI-03: Pass Rate

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `filter(s => Diagnostico_Final === 'si').length / sims.length` | Backend |
| **Computation** | O(N) filter + count | `COUNT(CASE WHEN pass THEN 1 END) / COUNT(*)` |
| **Edge case** | Lowercase 'si'/'Si' inconsistency handled client-side | Normalize on server |
| **Filter behavior** | Full re-scan per filter change | Server param |
| **Cache TTL** | 5 min | 15 min |
| **Lazy-loadable** | No | No |

---

### KPI-04: Active Advisors

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `new Set(sims.map(s => s.Usuario_Nombre))` | Backend `COUNT(DISTINCT Usuario)` |
| **Computation** | O(N) Set construction | O(1) server-side |
| **Filter behavior** | Full Set rebuild per filter | Server param |
| **Cache TTL** | 5 min | 15 min |
| **Lazy-loadable** | No | No |

---

### KPI-05: Total Activities

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `activities.length` from `dim_actividades` response | Activities metadata endpoint |
| **Computation** | Array.length on static metadata | Static — no computation needed |
| **Cache TTL** | 5 min | **24 hours** — activities rarely change |
| **Lazy-loadable** | No | No |
| **Note** | Activities metadata is essentially static. Should use a very long TTL. |

---

### KPI-06: Total Members / Admins / Supervisors

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `members.length`, `admins.filter(a => type === 'admin').length` | Members/admins endpoints |
| **Computation** | Array.length + filter | Backend counts in response metadata |
| **Current waste** | Full member objects fetched; only count used for this KPI | Add `count` to response (already exists in `MembersResponse.count`) |
| **Fix** | Use `res.count` instead of `res.data.length` | Use response `.count` field |
| **Cache TTL** | 5 min | **2 hours** — org structure changes infrequently |
| **Lazy-loadable** | Yes — org KPIs are secondary | Yes — load after hero KPIs |

---

### KPI-07: Best Score / Worst Score

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `Math.max(...sims.map(s => s.Calificacion))` | Backend `MAX()` / `MIN()` |
| **Computation** | O(N) spread (dangerous for large N — stack overflow risk!) | Backend aggregate |
| **Risk** | `Math.max(...array)` with 50k items → `RangeError: Maximum call stack size exceeded` | Eliminate |
| **Cache TTL** | 5 min | 15 min |
| **Lazy-loadable** | Yes — secondary metrics | Yes |

---

### KPI-08: Score Trend (Time Series)

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `computeTrend(sims)` — groups all sims by day | Backend time-series endpoint |
| **Computation** | O(N) grouping + O(D log D) sort (D = days) | Backend GROUP BY date |
| **Output** | One point per calendar day, regardless of range | Adaptive granularity |
| **Adaptive granularity** | N/A | ≤30 days → daily; ≤90 days → weekly; >90 days → monthly |
| **Cache TTL** | 5 min | 30 min |
| **Lazy-loadable** | Yes — below the fold | Yes — load after KPI cards |
| **Downsampling rule** | N/A | Max 60 data points returned from server |

**Target response shape:**
```json
{
  "granularity": "daily",
  "points": [
    { "date": "2026-04-27", "avg_score": 72, "count": 14, "pass_rate": 64 },
    { "date": "2026-04-28", "avg_score": 68, "count": 9, "pass_rate": 55 }
  ]
}
```

---

### KPI-09: Score Distribution (Histogram)

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `computeScoreDistribution(sims)` — 5 buckets, O(N) scan | Backend |
| **Computation** | O(N) pass through all sims | Backend `CASE WHEN` bucketing |
| **Buckets** | 0–20, 21–40, 41–60, 61–80, 81–100 (hardcoded) | Same buckets, backend |
| **Cache TTL** | 5 min | 30 min |
| **Lazy-loadable** | Yes — below the fold | Yes |

**Target response shape:**
```json
{
  "buckets": [
    { "label": "0–20", "count": 12 },
    { "label": "21–40", "count": 45 },
    { "label": "41–60", "count": 103 },
    { "label": "61–80", "count": 289 },
    { "label": "81–100", "count": 201 }
  ]
}
```

---

### KPI-10: Round / Interaction Stats (Puntos_1..5)

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `computeRoundStats(sims)` — 5 passes through full sim array | Backend |
| **Computation** | O(5N) with nullable filtering | Backend aggregate per column |
| **Output** | Per-interaction avg, pass rate, count | Same |
| **Cache TTL** | 5 min | 30 min |
| **Lazy-loadable** | Yes — Conversational page only | Yes — load on page entry |

**Target response shape:**
```json
{
  "rounds": [
    { "round": 1, "label": "I1", "avg": 0.82, "pass_rate": 78, "count": 1204 },
    { "round": 2, "label": "I2", "avg": 0.61, "pass_rate": 55, "count": 1198 }
  ]
}
```

---

### KPI-11: Activity Performance Stats

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `computeActivityStats(sims, activities)` — Map join, O(N) | Backend aggregate per activity |
| **Computation** | Build actMap, group sims by ID_Caso_de_Uso, compute per-group | Backend GROUP BY |
| **Current page usage** | OverviewPage (top 5), ActivitiesPage (all), ConversationalPage (all) | Same |
| **Cache TTL** | 5 min | 30 min |
| **Lazy-loadable** | Partially — top-5 eager, full list lazy | Yes |
| **Optimization** | Return activity names from join on server; frontend receives display-ready data | |

**Target response shape:**
```json
{
  "activities": [
    {
      "id": 331,
      "name": "Detalle del Producto",
      "activity_type": "Simulación",
      "count": 342,
      "avg_score": 71,
      "pass_rate": 65,
      "pass_count": 222,
      "fail_count": 120
    }
  ]
}
```

---

### KPI-12: User / Advisor Leaderboard

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `computeUserStats(sims)` — full groupBy user | Backend aggregate + rank |
| **Computation** | O(N) grouping + O(U log U) sort (U = unique users) | Backend GROUP BY + ORDER BY |
| **Current page usage** | OverviewPage (top 5), LeaderboardPage (all), CoachingPage (top/bottom 5) | Same via paginated endpoint |
| **Cache TTL** | 5 min | 15 min |
| **Lazy-loadable** | Top 5 → eager; full list → on LeaderboardPage entry | Yes |
| **Pagination** | None | PAGE_SIZE=25, cursor-based |

**Target response shape:**
```json
{
  "leaderboard": [
    {
      "name": "María González",
      "user_id": "magonzalez",
      "rank": 1,
      "count": 28,
      "avg_score": 87,
      "pass_rate": 89,
      "best_score": 98,
      "pass_count": 25
    }
  ],
  "total": 143,
  "page": 1,
  "page_size": 25
}
```

---

### KPI-13: Line Performance Stats (Business Lines)

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `computeLineStats(lines, members, sims)` — triple join | Backend |
| **Computation** | O(M×L) member grouping + O(N) sim routing | Backend JOIN |
| **Current page usage** | BusinessLinesPage only | Same |
| **Cache TTL** | 5 min | 30 min |
| **Lazy-loadable** | Yes — only on BusinessLinesPage | Yes — page entry |

---

### KPI-14: Organization Tree

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `buildOrgTree(admins, members)` | Backend hierarchy endpoint |
| **Computation** | O(A + M) tree construction from flat admin + member arrays | Backend recursive query or materialized tree |
| **Current page usage** | OrganizationPage only | Same |
| **Cache TTL** | 5 min | **2 hours** — org structure changes rarely |
| **Lazy-loadable** | Yes — only on OrganizationPage | Yes — page entry |

---

### KPI-15: Coaching Feedback (Extracted Text)

| Attribute | Current | Target |
|-----------|---------|--------|
| **Source** | `extractFeedback(sims)` — O(5N) flat expansion | Backend / drilldown |
| **Computation** | Iterates every sim × 5 rounds | On-demand only |
| **Current consumption** | **NONE** — computed but unused | Remove from useDashboardData |
| **Future use** | Per-simulation feedback in drilldown | Load only when user expands a sim row |
| **Cache TTL** | N/A (unused) | Per-simulation, 60 min |
| **Lazy-loadable** | N/A | **Only load on drilldown trigger** |

---

## AGGREGATION LAYER IMPLEMENTATION PLAN

Since the current backend (Rolplay API) does not expose aggregation endpoints, there are
two paths:

### Option A: Vercel Edge Function Aggregation Proxy (Recommended for Now)

Add Vercel serverless functions that:
1. Call the raw Rolplay endpoints
2. Aggregate/transform the response server-side
3. Return lightweight summary payloads
4. Leverage Vercel's edge caching (Cache-Control headers)

**Pros:** No changes to upstream API needed; caching at CDN edge.
**Cons:** Adds latency for the proxy hop; Vercel function cold start risk.

### Option B: Request Rolplay Backend Aggregation Endpoints

Work with the Rolplay backend team to add:
- `GET /sanfer/api/summary` (KPIs 1–7)
- `GET /sanfer/api/trend` (KPI 8)
- `GET /sanfer/api/activities/stats` (KPI 11)
- `GET /sanfer/api/leaderboard` (KPI 12, paginated)

**Pros:** Optimal performance; no proxy overhead.
**Cons:** Requires upstream API work; timeline dependency.

### Interim Solution (Implemented in Frontend Only)

Until the backend exposes aggregation endpoints:

1. **Memoize all analytics** in `useDashboardData` with `useMemo`
2. **Lift computed results** out of the hook and into the React Query cache
   (use `queryClient.setQueryData` to store derived results)
3. **Default to 30-day window** — drastically reduce payload size immediately
4. **Remove `extractFeedback`** from eager computation
5. **Use `res.count`** from MembersResponse/AdminsResponse instead of `data.length`

---

## CACHING MATRIX

| Data Type | Stale Time | GC Time | Refresh Strategy |
|-----------|------------|---------|-----------------|
| Summary KPIs | 15 min | 30 min | Background refetch on window focus |
| Activities metadata | 24 hours | 48 hours | Manual invalidation only |
| Org structure | 2 hours | 4 hours | Background refetch |
| Trend series | 30 min | 60 min | Stale-while-revalidate |
| Activity stats | 30 min | 60 min | On filter change |
| Leaderboard | 15 min | 30 min | On page entry |
| Line stats | 30 min | 60 min | On page entry |
| Sim detail (drilldown) | 60 min | 120 min | On demand only |
| Raw sims (30-day window) | 5 min | 15 min | On date filter change |

---

## QUERY KEY DESIGN

All queries must include filter parameters in their query key to ensure correct cache
invalidation when filters change:

```ts
// BAD — same cache entry for all date ranges:
queryKey: ['simulations']

// GOOD — separate cache entry per date window + filters:
queryKey: ['summary', { from, to, activityId, lineId }]
queryKey: ['trend', { from, to, granularity }]
queryKey: ['leaderboard', { from, to, page, pageSize }]
queryKey: ['activity-stats', { from, to }]
queryKey: ['activities-metadata']        // no params — static
queryKey: ['org-structure']              // no params — nearly static
queryKey: ['lines']                      // no params — nearly static
```
