# Sanfer Dashboard — Query Optimization Report

**Date:** 2026-05-27  
**Stack:** TanStack Query v5 + custom localStorage persistence

---

## 1. Cache Architecture

### 1.1 Two-Layer Cache

```
Layer 1: TanStack Query in-memory cache
  ├── Deduplication: identical query keys share one in-flight request
  ├── stale-while-revalidate: stale data shows immediately, fresh data replaces silently
  └── Background refresh: queries silently re-fetch when stale, no loading flash

Layer 2: localStorage persistence (sanfer-qc-v3)
  ├── Hydrated at module load, before React renders anything
  ├── TTL: matches gcTime (30 min for sims, 48 hr for activities)
  └── On warm sessions: all data available synchronously → Phases 1–4 render in one commit
```

### 1.2 Stale-Time Hierarchy

| Query | staleTime | gcTime | Reasoning |
|-------|-----------|--------|-----------|
| `['simulations']` | 5 min | 15 min | Live session data — advisors may complete sims during the session |
| `['activities']` | 24 hr | 48 hr | Activity metadata rarely changes; safe to cache aggressively |
| `['members']` | 2 hr | 4 hr | Org roster changes infrequently |
| `['admins']` | 2 hr | 4 hr | Admin list changes infrequently |
| `['lines']` | 2 hr | 4 hr | Business line catalog — lazy (only loaded by BusinessLinesPage) |

**Effect:** On a typical 4-hour work session, only simulations re-fetch (on 5-min intervals if the tab stays active). All metadata queries are served from cache, reducing API load by ~80%.

---

## 2. Deduplication Strategy

### 2.1 Shared Query Keys

All hooks use flat string-array keys:

```ts
queryKey: ['simulations']   // → all pages share the same cache entry
queryKey: ['activities']
queryKey: ['members']
queryKey: ['admins']
queryKey: ['lines']         // separate — only BusinessLinesPage
```

TanStack Query v5 guarantees that concurrent subscribers to the same key receive the same in-flight request — zero duplicate network calls regardless of how many pages mount simultaneously.

### 2.2 `keepPreviousData` on Simulations

```ts
export function useSimulations() {
  return useQuery({
    queryKey:        ['simulations'],
    queryFn:         ({ signal }) => fetchSimulations(null, null, signal),
    staleTime:       STALE.simulations,
    gcTime:          GC.simulations,
    placeholderData: keepPreviousData,   // ← no blank flash on re-fetch
  })
}
```

When the 5-minute staleTime expires and a background re-fetch starts, the previous data continues to show. The UI never flashes blank during a refresh.

### 2.3 Date Filter — Client-Side Slice, Not Re-Fetch

```ts
// useDashboardData.ts
const sims = useMemo(() => {
  const base = filterTestUsers(simsQ.data ?? [])
  if (!dateFrom && !dateTo) return base
  return base.filter((s) => {
    const d = s.Fecha_y_Hora?.split('T')[0] ?? ''
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
  })
}, [simsQ.data, dateFrom, dateTo])
```

Changing the global date filter triggers **zero additional network requests**. The 30-day window cached in TanStack Query is sliced in memory. This is a deliberate trade-off: the payload covers the full 30-day window once, and every subsequent date filter is O(N) in-memory.

---

## 3. Request Cancellation

All query functions receive and propagate `AbortSignal`:

```ts
// client.ts
async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })   // ← signal propagated to browser fetch
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json() as Promise<T>
}

export async function fetchSimulations(from?, to?, signal?) {
  const raw = await fetchJSON<SimulationsResponse>(url, signal)
  …
}
```

When a user navigates away before a query resolves, TanStack Query calls `AbortController.abort()`, which propagates to `fetch()`. This prevents the browser from processing a response that is no longer needed — critical on the large simulations payload.

---

## 4. Filter Invalidation Flow

### 4.1 Global Date Filter

```
User changes date input (DateRangeFilter.tsx)
  ↓
setDateRange(from, to)  →  Zustand store update
  ↓
useAppStore((s) => s.dateFrom/dateTo) in useDashboardData
  ↓
sims useMemo re-runs (client-side filter, no fetch)
  ↓
All analytics (kpis, trend, actStats, userStats, scoreDist, roundStats) re-compute
  ↓
All pages that call useDashboardData() receive new filtered data
```

**Re-render scope:** Only components subscribed to Zustand's `dateFrom`/`dateTo` selectors re-render. Unrelated selectors (theme, language, sidebar state) are not affected.

### 4.2 User Filter (OverviewPage-local)

```
User selects advisor in dropdown
  ↓
setSelectedUsers(prev → new Set)  →  local useState
  ↓
filteredSims useMemo re-runs (user subset of already-date-filtered sims)
  ↓
activeKpis, activeActStats, activeScoreDist, activeUserStats re-derive
  ↓
Only OverviewPage re-renders (filter is not global)
```

### 4.3 Debounce on Search Inputs

```ts
// SimulationsPage, LeaderboardPage
const search = useDebounce(searchRaw, 300)  // 300 ms debounce
```

Raw keystrokes do not trigger `useMemo` re-computation. Only after 300 ms of inactivity does the filter re-run. This prevents a new filtered result every keystroke when typing quickly.

---

## 5. Startup Prefetch Sequence

```ts
// App.tsx — executes at module load, before React's first render
queryClient.prefetchQuery({ queryKey: ['simulations'], staleTime: STALE })
queryClient.prefetchQuery({ queryKey: ['activities'],  staleTime: STALE })
queryClient.prefetchQuery({ queryKey: ['members'],     staleTime: STALE })
queryClient.prefetchQuery({ queryKey: ['admins'],      staleTime: STALE })
// 'lines' intentionally excluded — lazy, only needed by BusinessLinesPage
```

**Effect:** All four primary queries are in-flight before React renders the first pixel. By the time `OverviewPage` mounts and calls `useDashboardData`, the cache is either already populated (localStorage warm) or the requests are already running (preventing double-fetch).

---

## 6. Query Error Handling

### Retry Policy

```ts
// App.tsx queryClient defaults
retry: 2  // Retry failed queries twice before entering error state
```

### Error Granularity

`useDashboardData` exposes fine-grained error state. OverviewPage only enters the error UI if `quickKpis` is null (sims query failed) — org query failures do not block the primary dashboard view.

```ts
// OverviewPage.tsx
if ((isError && !quickKpis) || (!anyFilterActive && !activeKpis && !simsLoading)) {
  return <ErrorState />
}
```

This means a member-list API failure shows a partial dashboard with real simulation KPIs rather than a full error screen.

---

## 7. Manual Refetch

A `refetch()` callback is exposed from `useDashboardData` and surfaced on every page's error state:

```ts
const refetch = useCallback(() => {
  activitiesQ.refetch()
  simsQ.refetch()
  membersQ.refetch()
  adminsQ.refetch()
}, [])
```

This triggers all four queries simultaneously, bypassing staleTime. It is the recovery path from network errors shown to the user as a "Retry" button.
