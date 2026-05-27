# DASHBOARD PERFORMANCE AUDIT
**Sanfer Analytics Platform — Principal Engineer Review**
**Date:** 2026-05-27 | **Scope:** Full-stack frontend architecture

---

## EXECUTIVE SUMMARY

The dashboard is architecturally functional but structurally unscalable. Every page load
triggers 4–5 simultaneous raw-data fetches with no server-side filtering, date bounds, or
aggregation. The frontend then synchronously processes entire historical datasets on every
render across 8+ independent component instances. The result: slow initial load, repeated
heavy computation, and a UI that will collapse under any meaningful data growth.

**Severity classification:**

| Class | Count | Examples |
|-------|-------|---------|
| P0 — Data volume (root cause) | 2 | Full sims payload, 68-ID querystring |
| P1 — Computation (multiplied cost) | 4 | Unguarded analytics, duplicate hook instances |
| P2 — Rendering (DOM performance) | 3 | Unbounded tables, eager chart rendering |
| P3 — Architecture (maintainability) | 4 | Disconnected filter store, no client isolation |

---

## 1. ENDPOINT ANALYSIS

### 1.1 `rol_play_sim_extractor` — THE PRIMARY BOTTLENECK

```
GET /sanfer/api/rol_play_sim_extractor?id=331&id=343&id=344&...&id=493
```

**Problems:**
- **68 activity IDs** baked as individual query params → ~650-character querystring
- **No date range filter** — returns complete historical dataset from platform inception
- **No pagination** — returns every simulation record in a single response
- **Full row width** — each `Simulation` record carries 25+ fields including full free-text
  `Pregunta_N`, `Respuesta_N`, `Retroalimentacion_N` strings (avg ~500 bytes/record)
- **Estimated payload size:** At 10 000 records × 500 bytes ≈ **5 MB uncompressed JSON**
  (before Gzip; at 50k records this becomes 25 MB)

**Impact:** This single request is the dominant loading bottleneck. Every page blocks on it.

### 1.2 `dim_actividades` — OVER-FETCHING METADATA

```
GET /sanfer/api/dim_actividades?id=331&...&id=493
```

- Same 68-ID querystring repetition
- Returns activity metadata (names, criteria) which rarely changes
- **Not cached with a long TTL** despite being nearly static data
- `staleTime` is 5 minutes — should be hours for this endpoint

### 1.3 `/data/rolplay_sanfer_robin/members` — FULL MEMBER DUMP

- Returns every member with 25+ profile fields per record
- Dashboard only needs: `mb_id`, `mb_fullname`, `mb_user`, `mb_idTag1`, `mb_admin`, `mb_status`
- Unused fields transmitted: `mb_designation`, `mb_branch`, `mb_city`, `mb_country`,
  `mb_state`, `mb_headquarters`, `mb_user_token`, `mb_reference`, etc.
- **EstimateedField Overage:** ~60% of payload is unused on the frontend

### 1.4 `/data/rolplay_sanfer_robin/administrators` — BLOATED ADMIN DATA

- Same pattern — full admin profile sent when only name/email/type/parent/id are needed

### 1.5 `/data/rolplay_sanfer_robin/tag1` — STANDALONE 5TH CALL

- Only used in `BusinessLinesPage` via a separate `useLines()` query hook
- Not included in `useDashboardData` — causes a 5th sequential-looking request
  (though TanStack handles it in parallel, it delays the `BusinessLinesPage` specifically)

### 1.6 No server-side aggregation endpoint exists

There is no endpoint that returns pre-computed KPIs. The backend exposes only raw OLTP
tables. All aggregation (averages, pass rates, distributions, rankings) is computed
client-side on the full dataset.

---

## 2. QUERY LAYER PROBLEMS

### 2.1 Duplicate Query Subscriptions — Estimated 8× Analytics Recomputation

`useDashboardData()` is called from **8 components** simultaneously:

| Component | Hook Call | Computations Triggered |
|-----------|-----------|------------------------|
| `OverviewPage` | `useDashboardData()` | All 8 analytics functions |
| `SimulationsPage` | `useDashboardData()` | All 8 |
| `LeaderboardPage` | `useDashboardData()` | All 8 |
| `CoachingPage` | `useDashboardData()` | All 8 |
| `ActivitiesPage` | `useDashboardData()` | All 8 |
| `OrganizationPage` | `useDashboardData()` | All 8 |
| `ConversationalPage` | `useDashboardData()` | All 8 |
| `AIAssistant` | `useDashboardData()` | All 8 |

**TanStack Query correctly deduplicates the network fetch** (same query key = one request).
However, **the analytics computations inside `useDashboardData` are NOT memoized** —
they run as plain function calls in the hook body. This means:

- Every render of every subscribed component re-runs all 8 analytics functions
- Any Zustand state update (theme toggle, language change, sidebar collapse, AI panel
  open/close) triggers a re-render of the layout → triggers `useDashboardData` in the
  AIAssistant → re-runs all analytics

### 2.2 `extractFeedback()` is Computed but Never Consumed

```ts
// useDashboardData.ts line 36:
const feedback = isLoading || isError ? null : extractFeedback(sims)
```

`extractFeedback` iterates every simulation × 5 interaction rounds = up to 50,000
iterations on a 10k-record dataset. The result is returned from the hook but **no page
currently consumes `feedback`**. Dead computation on every render.

### 2.3 Global Filter Store is Completely Disconnected

`src/store/index.ts` maintains:
```ts
selectedActivityId: number | null
selectedLineId: number | null
dateFrom: string | null
dateTo: string | null
```

These are **never read by `useDashboardData`** or any query function. Each page
implements its own local filter state independently:
- `OverviewPage`: local `from`, `to`, `selectedUsers` useState
- Other pages: no filtering at all

The Zustand filter store is dead infrastructure. Filters do not compose across pages, do
not affect API calls, and do not debounce refetches.

### 2.4 No Request Cancellation

`fetchJSON` uses bare `fetch()` with no `AbortSignal`. When a user navigates away mid-load:
- The in-flight requests continue until completion
- TanStack Query's `queryFn` receives no cancellation mechanism
- Network resources are wasted on data for pages the user has already left

### 2.5 Default Date Window: Unbounded

No date default is applied anywhere. The simulations endpoint returns **everything** from
the first simulation ever recorded. As the platform scales over months and years, this
payload grows without bound. A deployment that is 18 months old will be 3–4× slower than
a 6-month-old deployment with zero code changes.

---

## 3. FRONTEND COMPUTATION PROBLEMS

### 3.1 `useDashboardData` — No Memoization on Analytics

```ts
// Current code — runs on every render, every time:
const kpis      = isLoading || isError ? null : computeKPIs(sims, activities, members, admins)
const trend     = isLoading || isError ? null : computeTrend(sims)
const roundStats = isLoading || isError ? null : computeRoundStats(sims)
const actStats  = isLoading || isError ? null : computeActivityStats(sims, activities)
const userStats = isLoading || isError ? null : computeUserStats(sims)
const scoreDist = isLoading || isError ? null : computeScoreDistribution(sims)
const orgTree   = isLoading || isError ? null : buildOrgTree(admins, members)
const feedback  = isLoading || isError ? null : extractFeedback(sims)
```

**Fix required:** Wrap every computation in `useMemo` with appropriate dependencies.

### 3.2 `computeTrend` — No Downsampling

```ts
export function computeTrend(sims: Simulation[]): TrendPoint[] {
  const byDate: Record<string, Simulation[]> = {}
  sims.forEach((s) => { /* group by day */ })
  return Object.entries(byDate).map(...)
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

If simulations span 18 months, this produces 540 data points for the trend chart.
Recharts renders all 540 points. No downsampling to weekly/monthly aggregation for
extended date ranges.

### 3.3 `computeUserStats` — Full O(N) Sort on Every Render

```ts
.sort((a, b) => b.avgScore - a.avgScore)
```

Sorting N users on every render. For leaderboard with 200 advisors = 200 comparisons
per render, every time. Should be `useMemo`-derived.

### 3.4 `computeActivityStats` and `computeLineStats` — Join Operations on Raw Data

Both functions perform Map-based joins across thousands of records on every render:
- `computeActivityStats`: cross-references sims × activities (68 activities × all sims)
- `computeLineStats`: triple-loop across members, userToLine map, simsByLine map

These are expensive O(N×M) operations that run uncached.

### 3.5 `buildAIContext()` — Passes Full Arrays into String Builder

```ts
export function buildAIContext(..., sims: Simulation[], ...): string {
  const recent = sims.slice(-5).map((s) => ...)
  return `Activities Available: ${activities.map((a) => a.Caso_de_Uso).join(', ')}`
```

The `activities.map(...)` joins 68 activity names into the AI context string on every
chat interaction. The full `sims` array is passed even though only `.slice(-5)` is used.

---

## 4. RENDERING PERFORMANCE PROBLEMS

### 4.1 SimulationsPage — Unbounded DOM Table

```tsx
{filtered.map((s) => (
  <Fragment key={s.ID_Sim}>
    <tr>...</tr>
    {expanded && <tr>...</tr>}
  </Fragment>
))}
```

If there are 5,000 simulations and no search filter is active, the DOM contains 5,000 `<tr>`
elements. Each with ~6 `<td>` cells = 30,000 DOM nodes. This will cause scroll jank and
heavy memory usage on any mid-range device.

**No virtualization. No pagination. No server-side search.**

### 4.2 LeaderboardPage — Unbounded DOM Table (Same Pattern)

Same unvirtualized `rows.map(...)` pattern. With 200 advisors this is manageable, but
at scale (enterprise-wide deployment) this becomes a problem.

### 4.3 OrganizationPage — Hardcoded `members.slice(0, 50)` Limit

```tsx
{members.slice(0, 50).map((m) => ( ... ))}
```

This is a silent data truncation. Users with >50 members silently lose data. Not
communicated in the UI. Should be paginated, not sliced.

### 4.4 All Charts Render Immediately on Page Mount

All Recharts charts (`AreaChart`, `BarChart`, `PieChart`, `RadarChart`) render eagerly
on mount. There is no:
- Lazy rendering on scroll into view
- Progressive loading (skeleton → chart)
- Chart size limiting for mobile viewports

### 4.5 OverviewPage — 6 Charts Rendered Simultaneously

On Overview, 6 charts render at the same time:
1. AreaChart (trend)
2. PieChart (pass/fail)
3. BarChart (activity breakdown)
4. User stats table (with computed rankings)
5. Score distribution BarChart
6. KPI cards (computed values)

All 6 derive from the same data, but recalculate conditionally when filters change via
separate `useMemo` calls — some of which depend on `dateActive` boolean, meaning even
adding a single user to the filter re-runs all 4 recalculations.

---

## 5. ARCHITECTURAL PROBLEMS

### 5.1 No Client Isolation — Hardcoded Sanfer Constants

```ts
// client.ts
const BASE   = '/sanfer/api'
const CLIENT = 'rolplay_sanfer_robin'
const SANFER_IDS = [331, 343, 344, ...]
```

These are hardcoded in the source. Adding Gentera or Apotex requires duplicating this
file. No config-driven multi-tenant architecture exists.

### 5.2 No Shared Component Library

Each page redefines tooltip styles, KPI card patterns, and loading skeletons. Shared UI
components exist (`KPICard`, `Skeleton`) but are not consistently used. `OverviewPage`
defines its own local `KpiCard` component that duplicates `KPICard` from `ui/`.

### 5.3 No Error Boundaries Per Section

`ErrorBoundary` component exists but is only applied at the page level (if at all). A
single failed API request (e.g., the lines endpoint) prevents the entire page from rendering.
Individual sections should have isolated error recovery.

### 5.4 Analytics Functions Are Not Unit-Tested

`analytics.ts` contains 9 pure functions with complex logic (pass threshold decisions,
line-to-user mapping, round filtering). None appear to have test coverage. Regressions
in this layer affect all pages simultaneously.

### 5.5 AI Assistant Creates Its Own `useDashboardData` Subscription

The AI panel uses `useDashboardData()` to build context. This means even when the panel
is closed, if the component is mounted (it's always mounted as part of the Shell), it
holds its own hook instance and triggers all 8 analytics computations on every render.

---

## 6. MOBILE / RESPONSIVE PROBLEMS

### 6.1 Chart Containers Use Fixed Heights Without Overflow Guards

```tsx
<div className="h-72">
  <ResponsiveContainer width="100%" height="100%">
```

`ResponsiveContainer` with `width="100%"` and a fixed parent height works on desktop but
causes layout issues on narrow viewports when the card wraps unexpectedly.

### 6.2 Leaderboard Table Hides Columns on Mobile — No Horizontal Scroll

Some columns use `hidden sm:table-cell` — acceptable — but the table has no
`overflow-x-auto` wrapper, causing potential layout overflow on very narrow screens.

### 6.3 Sidebar Z-Index and Mobile Menu Interaction

The AI panel (`z-50`) and the mobile sidebar overlay (`z-50`) compete for the same
stacking context. Opening both simultaneously could cause visual conflicts.

---

## 7. SUMMARY — PRIORITY REMEDIATION MATRIX

| Priority | Issue | Fix | Effort |
|----------|-------|-----|--------|
| P0 | Full sims payload, no date bound | Add default 30-day window, server-side date param | High |
| P0 | 68-ID querystring, no aggregation | Create summary KPI endpoint | High |
| P1 | Unguarded analytics in useDashboardData | Wrap all in useMemo | Low |
| P1 | `extractFeedback` dead computation | Remove from hook, lazy-load on demand | Low |
| P1 | Disconnected filter store | Wire Zustand filters to query keys | Medium |
| P1 | AI context passes full sims array | Pass only pre-computed kpis + recent slice | Low |
| P2 | SimulationsPage unbounded table | Virtualize with @tanstack/virtual | Medium |
| P2 | OrgPage silent slice(0,50) | Paginate properly | Low |
| P2 | All charts eager render | Lazy render on scroll (Intersection Observer) | Medium |
| P3 | Hardcoded client constants | Config-driven multi-tenant layer | High |
| P3 | No shared component library | Extract shared/ module | High |
| P3 | No request AbortSignal | Add to fetchJSON wrapper | Low |
| P3 | No analytics test coverage | Unit tests for analytics.ts | Medium |
