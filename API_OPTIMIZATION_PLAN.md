# API OPTIMIZATION PLAN
**Sanfer Analytics Platform — Endpoint Design & Request Architecture**
**Date:** 2026-05-27

---

## OVERVIEW

This document specifies the optimized API surface the dashboard should consume,
the request patterns it should use, the caching strategy per endpoint, and the
phased implementation roadmap.

The plan is designed to work in two modes:
- **Phase 1 (Frontend-only):** No backend changes, maximum gains from client-side architecture
- **Phase 2 (Full stack):** Backend aggregation endpoints unlock true scalability

---

## CURRENT ENDPOINT PROBLEMS SUMMARY

| Endpoint | Problem | Payload Est. | Fix |
|----------|---------|-------------|-----|
| `rol_play_sim_extractor?id=x68` | Full history, no date, no aggregation | 5–25 MB | Split + date bound + aggregate |
| `dim_actividades?id=x68` | Repeated 68-ID QS, rarely changes | ~50 KB | Long TTL, 24h cache |
| `/data/.../members` | All fields, all records | ~200 KB | Field selection, longer TTL |
| `/data/.../administrators` | All fields | ~20 KB | Field selection, longer TTL |
| `/data/.../tag1` | Only used by one page | ~5 KB | On-demand load only |

---

## PHASE 1: FRONTEND ARCHITECTURE OPTIMIZATIONS
### (No backend changes required)

### 1.1 Default 30-Day Date Window

Apply a default date range **immediately** to `fetchSimulations`. This is the single
highest-impact change possible without touching the backend.

```ts
// src/api/client.ts — UPDATED

function defaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    to:   to.toISOString().split('T')[0],   // YYYY-MM-DD
    from: from.toISOString().split('T')[0],
  }
}

export async function fetchSimulations(
  from?: string,
  to?: string,
): Promise<Simulation[]> {
  const { from: defFrom, to: defTo } = defaultDateRange()
  const dateFrom = from ?? defFrom
  const dateTo   = to   ?? defTo

  // Note: add date params only if the API supports them.
  // If not, fetch full set but then immediately slice client-side.
  const params = new URLSearchParams()
  SANFER_IDS.forEach((id) => params.append('id', String(id)))
  // Future backend params (add when API supports them):
  // params.set('from', dateFrom)
  // params.set('to', dateTo)

  const raw = await fetchJSON<SimulationsResponse>(
    `${BASE}/rol_play_sim_extractor?${params}`
  )
  const all = Array.isArray(raw) ? raw : (raw.data ?? [])

  // Client-side date guard until backend supports params
  return all.filter((s) => {
    const d = s.Fecha_y_Hora?.split('T')[0]
    return d >= dateFrom && d <= dateTo
  })
}
```

**Impact:** Reduces active dataset from 18 months of data to 30 days.
Typical reduction: **80–95% fewer records rendered and processed.**

---

### 1.2 Filter Parameters in Query Keys

Wire the Zustand filter state to TanStack Query keys so filters invalidate the correct
cache slice and trigger refetches with the right parameters.

```ts
// src/api/queries.ts — UPDATED

export function useSimulations() {
  const { dateFrom, dateTo, selectedActivityId, selectedLineId } = useAppStore()

  return useQuery({
    queryKey: ['simulations', { dateFrom, dateTo, selectedActivityId, selectedLineId }],
    queryFn: () => fetchSimulations(dateFrom ?? undefined, dateTo ?? undefined),
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,   // no blank flash on filter change
  })
}

export function useSummaryKPIs() {
  const { dateFrom, dateTo } = useAppStore()
  return useQuery({
    queryKey: ['summary-kpis', { dateFrom, dateTo }],
    queryFn: () => fetchSummaryKPIs(dateFrom, dateTo),
    staleTime: 1000 * 60 * 15,
  })
}
```

---

### 1.3 Memoize All Analytics Computations

Move analytics out of the hook body into properly memoized selectors:

```ts
// src/hooks/useDashboardData.ts — UPDATED

export function useDashboardData() {
  const activitiesQ = useQuery({ queryKey: ['activities'], queryFn: fetchActivities, staleTime: 1000 * 60 * 60 * 24 })
  const simsQ       = useSimulations()
  const membersQ    = useQuery({ queryKey: ['members'], queryFn: fetchMembers, staleTime: 1000 * 60 * 120 })
  const adminsQ     = useQuery({ queryKey: ['admins'], queryFn: fetchAdmins, staleTime: 1000 * 60 * 120 })

  const isLoading = simsQ.isLoading || activitiesQ.isLoading || membersQ.isLoading || adminsQ.isLoading
  const isError   = simsQ.isError   || activitiesQ.isError   || membersQ.isError   || adminsQ.isError

  const activities = useMemo(() => activitiesQ.data?.data ?? [], [activitiesQ.data])
  const rawSims    = useMemo(() => simsQ.data ?? [], [simsQ.data])
  const members    = useMemo(() => membersQ.data?.data ?? [], [membersQ.data])
  const admins     = useMemo(() => adminsQ.data?.data ?? [], [adminsQ.data])
  const sims       = useMemo(() => filterTestUsers(rawSims), [rawSims])

  // All analytics properly memoized — only recompute when source data changes
  const kpis      = useMemo(() => isLoading || isError ? null : computeKPIs(sims, activities, members, admins), [sims, activities, members, admins, isLoading, isError])
  const trend     = useMemo(() => isLoading || isError ? null : computeTrend(sims), [sims, isLoading, isError])
  const roundStats = useMemo(() => isLoading || isError ? null : computeRoundStats(sims), [sims, isLoading, isError])
  const actStats  = useMemo(() => isLoading || isError ? null : computeActivityStats(sims, activities), [sims, activities, isLoading, isError])
  const userStats = useMemo(() => isLoading || isError ? null : computeUserStats(sims), [sims, isLoading, isError])
  const scoreDist = useMemo(() => isLoading || isError ? null : computeScoreDistribution(sims), [sims, isLoading, isError])
  const orgTree   = useMemo(() => isLoading || isError ? null : buildOrgTree(admins, members), [admins, members, isLoading, isError])
  // NOTE: extractFeedback removed — computed on demand only

  return { isLoading, isError, activities, sims, members, admins, kpis, trend, roundStats, actStats, userStats, scoreDist, orgTree, refetch: () => { simsQ.refetch(); activitiesQ.refetch() } }
}
```

---

### 1.4 Priority-Tiered Loading

Load data in order of display priority, not alphabetically:

```
Tier 1 (Hero KPIs — must be instant):
  fetchSimulations + fetchActivities → computeKPIs

Tier 2 (Charts — load after hero):
  computeTrend, computeScoreDistribution, computeActivityStats

Tier 3 (Secondary pages — load on demand):
  fetchMembers → org tree
  fetchAdmins  → admin counts
  fetchLines   → business lines (only on BusinessLinesPage)
```

Implementation: `enabled` flag on Tier 2/3 queries:

```ts
// Members only needed for org/leaderboard pages
export function useMembers() {
  const location = useLocation()
  const needsMembers = ['/organization', '/business-lines'].includes(location.pathname)
  return useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
    staleTime: 1000 * 60 * 120,
    enabled: needsMembers,
    select: (res) => res.data,
  })
}
```

---

### 1.5 Request Cancellation

Add AbortSignal support to `fetchJSON`:

```ts
async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json() as Promise<T>
}
```

TanStack Query automatically provides an AbortSignal to queryFns:

```ts
queryFn: ({ signal }) => fetchSimulations(dateFrom, dateTo, signal),
```

---

### 1.6 Stale Time Differentiation

Different data types have very different change frequencies:

```ts
const STALE = {
  simulations:        1000 * 60 * 5,      //  5 min — active session data
  activities:         1000 * 60 * 60 * 24, // 24 hrs — static metadata
  members:            1000 * 60 * 120,     //  2 hrs — org structure
  admins:             1000 * 60 * 120,     //  2 hrs — org structure
  lines:              1000 * 60 * 120,     //  2 hrs — line catalog
  summaryKpis:        1000 * 60 * 15,      // 15 min — aggregated dashboard
  trend:              1000 * 60 * 30,      // 30 min — chart data
}
```

---

## PHASE 2: OPTIMIZED API SURFACE DESIGN
### (Requires backend implementation or Vercel proxy functions)

---

### Endpoint 1: Dashboard Summary KPIs

```
GET /sanfer/api/summary
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | `YYYY-MM-DD` | 30 days ago | Start date (inclusive) |
| `to` | `YYYY-MM-DD` | today | End date (inclusive) |
| `activity_id` | `number[]` | all Sanfer IDs | Filter by activity |
| `line_id` | `number` | — | Filter by business line |

**Response Shape:**

```json
{
  "from": "2026-04-27",
  "to": "2026-05-27",
  "total_simulations": 1842,
  "avg_score": 71.4,
  "pass_rate": 63.2,
  "pass_count": 1164,
  "fail_count": 678,
  "active_advisors": 94,
  "best_score": 100,
  "worst_score": 8,
  "score_distribution": [
    { "label": "0–20",   "count": 21 },
    { "label": "21–40",  "count": 87 },
    { "label": "41–60",  "count": 214 },
    { "label": "61–80",  "count": 891 },
    { "label": "81–100", "count": 629 }
  ]
}
```

**Caching:** `Cache-Control: public, max-age=900, stale-while-revalidate=1800`
**Frontend staleTime:** 15 minutes

---

### Endpoint 2: Trend Series

```
GET /sanfer/api/trend
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | `YYYY-MM-DD` | 30 days ago | Start |
| `to` | `YYYY-MM-DD` | today | End |
| `granularity` | `daily\|weekly\|monthly` | auto | Auto: daily ≤30d, weekly ≤90d, monthly >90d |
| `activity_id` | `number[]` | all | Filter |

**Response Shape:**

```json
{
  "from": "2026-04-27",
  "to": "2026-05-27",
  "granularity": "daily",
  "max_points": 60,
  "points": [
    { "date": "2026-04-27", "avg_score": 68, "count": 22, "pass_rate": 59 },
    { "date": "2026-04-28", "avg_score": 74, "count": 18, "pass_rate": 67 }
  ]
}
```

**Caching:** `Cache-Control: public, max-age=1800`
**Frontend staleTime:** 30 minutes

---

### Endpoint 3: Activity Stats

```
GET /sanfer/api/activities/stats
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | `YYYY-MM-DD` | 30 days ago | |
| `to` | `YYYY-MM-DD` | today | |
| `sort` | `count\|avg_score\|pass_rate` | `count` | Sort field |
| `order` | `asc\|desc` | `desc` | Sort direction |

**Response Shape:**

```json
{
  "total": 68,
  "activities": [
    {
      "id": 331,
      "name": "Detalle del Producto — Cardiología",
      "activity_type": "Simulación",
      "count": 342,
      "avg_score": 71,
      "pass_rate": 65,
      "pass_count": 222,
      "fail_count": 120,
      "round_stats": [
        { "round": 1, "avg": 0.82, "pass_rate": 78 },
        { "round": 2, "avg": 0.61, "pass_rate": 55 }
      ]
    }
  ]
}
```

**Caching:** `Cache-Control: public, max-age=1800`

---

### Endpoint 4: Leaderboard (Paginated)

```
GET /sanfer/api/leaderboard
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | `YYYY-MM-DD` | 30 days ago | |
| `to` | `YYYY-MM-DD` | today | |
| `page` | `number` | 1 | Page number |
| `page_size` | `number` | 25 | Max 100 |
| `sort` | `avg_score\|count\|pass_rate\|best_score` | `avg_score` | |
| `order` | `asc\|desc` | `desc` | |
| `search` | `string` | — | Name filter (server-side) |
| `line_id` | `number` | — | Filter by business line |

**Response Shape:**

```json
{
  "total": 143,
  "page": 1,
  "page_size": 25,
  "total_pages": 6,
  "leaderboard": [
    {
      "rank": 1,
      "name": "María González",
      "user_id": "magonzalez",
      "count": 28,
      "avg_score": 87,
      "pass_rate": 89,
      "best_score": 98,
      "pass_count": 25,
      "line_id": 4,
      "line_name": "Cardiología"
    }
  ]
}
```

**Frontend implementation:**

```ts
export function useLeaderboard(params: LeaderboardParams) {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: ({ signal }) => fetchLeaderboard(params, signal),
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,   // smooth pagination
  })
}
```

---

### Endpoint 5: Interaction Detail (Drilldown)

```
GET /sanfer/api/simulations/:sim_id/detail
```

Loads full interaction data (questions, responses, feedback) **only when user
expands a simulation row**. Never loaded upfront.

**Response Shape:**

```json
{
  "sim_id": 18442,
  "user_name": "Carlos Ramos",
  "activity_name": "Detalle del Producto",
  "date": "2026-05-15",
  "score": 74,
  "passed": true,
  "interactions": [
    {
      "round": 1,
      "question": "¿Cuáles son las indicaciones principales del producto?",
      "response": "El producto está indicado para...",
      "feedback": "Respuesta correcta. Mencionaste las 3 indicaciones principales.",
      "points": 1
    }
  ]
}
```

**Caching:** Per-simulation, 60 min (immutable after recording)
**Frontend implementation:**

```ts
// Only fires when expandedSimId is set
export function useSimDetail(simId: number | null) {
  return useQuery({
    queryKey: ['sim-detail', simId],
    queryFn: ({ signal }) => fetchSimDetail(simId!, signal),
    enabled: simId !== null,
    staleTime: 1000 * 60 * 60,  // 1 hour — sim data is immutable
    gcTime: 1000 * 60 * 60 * 2,
  })
}
```

---

### Endpoint 6: Business Lines Stats

```
GET /sanfer/api/lines/stats
```

**Response Shape:**

```json
{
  "lines": [
    {
      "id": 4,
      "name": "Cardiología",
      "member_count": 34,
      "sim_count": 412,
      "avg_score": 73,
      "pass_rate": 68,
      "pass_count": 280,
      "active_users": 28
    }
  ]
}
```

**Caching:** 30 min
**Loaded:** Only on BusinessLinesPage entry

---

### Endpoint 7: Org Hierarchy

```
GET /sanfer/api/org/hierarchy
```

Returns pre-built tree — no client-side tree construction:

```json
{
  "tree": [
    {
      "id": 12,
      "name": "Regional Norte",
      "type": "supervisor",
      "email": "norte@sanfer.com",
      "parent_id": 0,
      "member_count": 45,
      "children": [
        {
          "id": 23,
          "name": "Zona Ciudad de México",
          "type": "admin",
          ...
        }
      ]
    }
  ],
  "total_members": 412,
  "total_admins": 8,
  "total_supervisors": 3
}
```

**Caching:** 2 hours
**Loaded:** Only on OrganizationPage entry

---

## FILTERING STRATEGY

### Centralized Filter State → Query Key Binding

```ts
// src/store/filters.ts (new, split from store/index.ts)

interface FilterState {
  dateFrom: string  // ISO date, default: 30 days ago
  dateTo:   string  // ISO date, default: today
  activityIds: number[]  // empty = all Sanfer activities
  lineId:      number | null
  userId:      string | null
}

// On filter change → all dependent queries automatically refetch
// because queryKey includes filter state
```

### Debounced Filter Refetch

Free-text search fields must debounce to avoid firing a query on every keystroke:

```ts
// 400ms debounce on text inputs that affect API calls
const [searchRaw, setSearchRaw] = useState('')
const search = useDebounce(searchRaw, 400)

// search goes into queryKey → triggers refetch only after 400ms idle
```

### Server-Side vs Client-Side Filtering Decision Matrix

| Filter Type | Phase 1 (Client-side) | Phase 2 (Server-side) |
|-------------|----------------------|----------------------|
| Date range | Client filter on 30d window | Query param |
| Activity | Client filter on fetched set | Query param |
| Business line | Client via user→line mapping | Query param |
| User name search (leaderboard) | Client filter | Query param |
| Score range (drilldown) | Client filter | Query param |

---

## PAGINATION STRATEGY

### SimulationsPage

```
Current:  Render ALL sims in DOM
Phase 1:  Client-side pagination (PAGE_SIZE = 50) + virtualization
Phase 2:  Server-side pagination (cursor-based)
```

```ts
// Phase 1: paginate the filtered array
const PAGE_SIZE = 50
const [page, setPage] = useState(0)
const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
```

### LeaderboardPage

```
Current:  Render ALL users in DOM
Phase 1:  Client pagination (PAGE_SIZE = 25)
Phase 2:  Server paginated endpoint with sort/search params
```

### OrganizationPage Members Table

```
Current:  Hardcoded slice(0, 50) — silent truncation
Phase 1:  Client pagination replacing the slice
Phase 2:  Server paginated members endpoint
```

---

## REQUEST PARALLELISM DESIGN

### Current (implicit parallel via TanStack):
All 5 queries fire simultaneously — good for parallelism but bad because non-critical
requests compete with the critical simulations request on the same HTTP/2 connection.

### Target (priority-tiered parallel):

```
Browser loads page
│
├─ PRIORITY 1 (immediate, parallel):
│   ├─ GET /summary          → KPI cards (hero content)
│   └─ GET /activities/stats → Overview charts
│
├─ PRIORITY 2 (deferred 100ms, parallel):
│   ├─ GET /trend            → Trend chart
│   └─ GET /activities       → Activity metadata (24h cache — likely HIT)
│
└─ PRIORITY 3 (on-demand):
    ├─ GET /leaderboard       → Only on LeaderboardPage
    ├─ GET /org/hierarchy     → Only on OrganizationPage
    ├─ GET /lines/stats       → Only on BusinessLinesPage
    └─ GET /simulations/:id   → Only on row expand
```

Implementation with `enabled` and lazy query activation:

```ts
// Load priority-3 queries only when their page is active
const isLeaderboardPage = location.pathname === '/leaderboard'

export function useLeaderboardData() {
  return useQuery({
    queryKey: ['leaderboard', filters],
    queryFn: fetchLeaderboard,
    enabled: isLeaderboardPage,  // do not fetch until on this page
    staleTime: 1000 * 60 * 15,
  })
}
```

---

## CHART DATA OPTIMIZATION

### Trend Chart Downsampling

```ts
// Max 60 points for the trend chart regardless of date range
function downsample(points: TrendPoint[], maxPoints = 60): TrendPoint[] {
  if (points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  return points.filter((_, i) => i % step === 0)
}
```

### Activity Bar Chart — Top N Only

```ts
// Activities page: show top 10 in chart, load rest on "Show more"
const TOP_N = 10
const chartData = actStats.slice(0, TOP_N)
const hasMore = actStats.length > TOP_N
```

---

## MULTI-CLIENT ARCHITECTURE DESIGN

To support Gentera, Sanfer, and Apotex dashboards from the same codebase:

### Directory Structure

```
src/
├── clients/
│   ├── sanfer/
│   │   ├── config.ts          ← CLIENT, SANFER_IDS, BASE, branding
│   │   ├── api/               ← Sanfer-specific endpoints
│   │   └── pages/             ← Any Sanfer-only pages
│   ├── gentera/
│   │   ├── config.ts
│   │   └── api/
│   └── apotex/
│       ├── config.ts
│       └── api/
│
├── shared/
│   ├── api/
│   │   ├── base.ts            ← fetchJSON, AbortSignal, error handling
│   │   └── types.ts           ← Common Simulation, Member, Activity types
│   ├── analytics/
│   │   ├── kpis.ts            ← computeKPIs, computeTrend, etc.
│   │   └── filters.ts         ← filterTestUsers, date utils
│   ├── charts/
│   │   ├── TrendChart.tsx
│   │   ├── PassFailDonut.tsx
│   │   ├── ScoreHistogram.tsx
│   │   └── ActivityBar.tsx
│   ├── ui/
│   │   ├── KPICard.tsx
│   │   ├── Skeleton.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── VirtualTable.tsx   ← NEW — virtualized table
│   ├── hooks/
│   │   ├── useDashboardData.ts
│   │   ├── useFilters.ts
│   │   └── useDebounce.ts
│   └── store/
│       ├── filters.ts         ← Extracted filter store
│       └── ui.ts              ← Theme, language, sidebar state
│
├── App.tsx                    ← Client-driven routing
└── main.tsx
```

### Client Config Pattern

```ts
// src/clients/sanfer/config.ts
export const SANFER_CONFIG: ClientConfig = {
  id:          'sanfer',
  displayName: 'Sanfer',
  apiBase:     '/sanfer/api',
  clientSlug:  'rolplay_sanfer_robin',
  activityIds: [331, 343, 344, ...],
  branding: {
    primaryColor: '#CC1F2D',
    logoComponent: SanferLogo,
  },
  features: {
    businessLines: true,
    conversationalIntelligence: true,
    orgHierarchy: true,
  },
  testUserBlocklist: [
    'Tester Sanfer Demo',
    'Tester Sanfer Grupal',
    ...
  ],
}
```

---

## IMPLEMENTATION ROADMAP

### Sprint 1 — P0 Fixes (1 week, no backend changes)

| Task | File(s) | Impact |
|------|---------|--------|
| Add 30-day default date window | `api/client.ts` | ~90% payload reduction |
| Memoize all analytics in `useDashboardData` | `hooks/useDashboardData.ts` | Eliminates duplicate computation |
| Remove `extractFeedback` from eager load | `hooks/useDashboardData.ts` | Removes dead O(5N) computation |
| Wire Zustand filter state to query keys | `api/queries.ts`, `store/index.ts` | Filter system starts working |
| Add `AbortSignal` to `fetchJSON` | `api/client.ts` | Clean request cancellation |
| Differentiate stale times per endpoint | `api/queries.ts` | Activities: 24h; Org: 2h |
| Use `res.count` for members/admins KPIs | `lib/analytics.ts` | Avoids iterating full arrays |

### Sprint 2 — Rendering (1 week)

| Task | File(s) | Impact |
|------|---------|--------|
| Paginate SimulationsPage (50/page) | `pages/SimulationsPage.tsx` | DOM from ~5k to 50 rows |
| Paginate LeaderboardPage (25/page) | `pages/LeaderboardPage.tsx` | DOM from ~150 to 25 rows |
| Fix OrgPage silent slice → pagination | `pages/OrganizationPage.tsx` | Data completeness |
| Lazy-load charts with IntersectionObserver | All chart pages | Initial render faster |
| Trend chart downsampling (max 60 pts) | `lib/analytics.ts` | Chart render performance |
| Priority-gated query loading | `api/queries.ts` | Faster hero KPI display |

### Sprint 3 — Architecture (2 weeks)

| Task | File(s) | Impact |
|------|---------|--------|
| Extract `shared/` module | Multiple | Multi-client reusability |
| Config-driven client system | `clients/sanfer/config.ts` | Gentera/Apotex support |
| Split filter store from UI store | `store/` | Clean separation of concerns |
| Add `useDebounce` for search inputs | New hook | Reduce query thrashing |
| `useSimDetail` lazy drilldown hook | `api/queries.ts` | True lazy loading |
| Error boundaries per section | All pages | Isolated failure recovery |

### Sprint 4 — Backend Aggregation (3+ weeks, backend team required)

| Task | Endpoint | Impact |
|------|---------|--------|
| Build `/summary` endpoint | New | Hero KPIs in <100ms |
| Build `/trend` endpoint | New | Trend data in <200ms |
| Build `/activities/stats` endpoint | New | Activity charts server-aggregated |
| Build `/leaderboard` endpoint | New | Server-side sort/search/pagination |
| Build `/lines/stats` endpoint | New | Business lines pre-computed |
| Build `/org/hierarchy` endpoint | New | Pre-built org tree |
| Build `/simulations/:id/detail` endpoint | New | Drilldown on demand |

---

## SUCCESS METRICS

| Metric | Current | Target (Phase 1) | Target (Phase 2) |
|--------|---------|-----------------|-----------------|
| Initial payload size | 5–25 MB | <500 KB (30d window) | <10 KB (summary only) |
| Time to first KPI display | 4–8s | 1–2s | <500ms |
| Computation per navigation | O(N) × 8 | O(1) (memoized) | O(1) (pre-aggregated) |
| Simulation table DOM nodes | N × 6 (~30k) | 50 × 6 (300) | 50 × 6 (300) |
| Duplicate analytics runs | 8× per state change | 1× per data change | 0 (server-side) |
| Filter response time | Full re-scan | debounced re-scan | Server param refetch |
| Mobile performance score | ~40 | ~70 | ~90 |
