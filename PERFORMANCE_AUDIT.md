# Sanfer Dashboard — Performance Audit

**Date:** 2026-05-27  
**Engineer:** Principal Frontend Performance Review  
**Scope:** Full codebase audit — rendering, querying, bundling, data processing

---

## 1. Executive Summary

The dashboard suffered from four primary bottlenecks:

| Priority | Bottleneck | Category | Status |
|----------|-----------|----------|--------|
| P0 | `ConversationalPage` — `useMemo` called after conditional `return` (React Rules of Hooks violation) | Critical Bug | **Fixed** |
| P1 | `AIAssistant` always mounted — triggers `useDashboardData`, Framer Motion, 5 useState, 4 useRef on every page load | Render cost | **Fixed** |
| P2 | Overview KPI cards wait for all 4 API queries (including org data) before rendering | Time-to-content | **Fixed** |
| P3 | Below-fold chart sections (activity breakdown, score distribution, top performers) mount immediately at page load | Unnecessary render | **Fixed** |

---

## 2. Payload Analysis

### API Endpoints

| Endpoint | Type | Est. Size | Cache TTL | Notes |
|----------|------|-----------|-----------|-------|
| `rol_play_sim_extractor?id=…` (67 IDs) | Fact table | Large (varies) | 5 min | Primary bottleneck — full text per row: 5 questions + 5 responses + 5 feedbacks |
| `dim_actividades?id=…` | Dimension | Small | 24 hr | Activity metadata, nearly static |
| `data/rolplay_sanfer_robin/members` | Org list | Medium | 2 hr | Full member roster |
| `data/rolplay_sanfer_robin/administrators` | Org list | Small | 2 hr | Admin/supervisor list |
| `data/rolplay_sanfer_robin/tag1` | Catalog | Tiny | 2 hr | Business line catalog (lazy, only BusinessLinesPage) |

### Simulation Row Size

Each `Simulation` object carries **28 fields**, including 5 × (question + response + feedback) strings that can each be hundreds of characters. On a dataset of several hundred simulations this results in a payload of several hundred KB before the 30-day window filter is applied client-side.

**Mitigation already in place:** client-side 30-day date filter in `fetchSimulations` cuts the working dataset by 80–95%.

---

## 3. Render Analysis

### 3.1 AI Assistant — Always-Mounted Component (P1)

**Before:**
```tsx
// Shell.tsx
const AIAssistant = lazy(() => import('../ai/AIAssistant')…)
<Suspense fallback={null}>
  <AIAssistant />   ← unconditional — React renders immediately, lazy fires at once
</Suspense>
```

`lazy()` defers the module _download_, but because `<AIAssistant />` was in the JSX unconditionally, React attempted to render it on every mount, triggering the lazy import immediately. Once loaded, `AIAssistant` called `useDashboardData()` (subscribing to all analytics), initialized Framer Motion springs, 5 `useState` variables, 4 `useRef`s, and registered a paste event listener — **all before the user ever opened the panel.**

**After:**
```tsx
// Shell.tsx — AiBubble is tiny (no data deps), AIAssistant panel is conditional
<AiBubble />
{aiOpen && (
  <Suspense fallback={null}>
    <AIAssistantPanel />
  </Suspense>
)}
```

The full panel now mounts **only when the user clicks the button.** `AiBubble.tsx` is a ~200 B component with zero data subscriptions.

### 3.2 ConversationalPage — Rules of Hooks Violation (P0)

```tsx
// BEFORE — hooks after conditional returns (illegal)
if (isLoading) return <Skeleton />   // ← early exit
if (isError)   return <Error />      // ← early exit
const stats = roundStats ?? []
const simStats = useMemo(…)          // ← hook after return — violation
```

React's reconciler relies on a stable hook call order per render. When `isLoading` is `true`, the `useMemo` is never called; when `isLoading` flips to `false`, it suddenly appears — causing a hook count mismatch that results in incorrect memoization, potential runtime errors in strict mode, and unreliable behavior across React versions.

**After:** All `useMemo` declarations moved unconditionally before any early return.

### 3.3 Overview KPI Waterfall (P2)

**Before:** `useDashboardData.kpis` was gated on `simsLoading || activitiesLoading || isError` (where `isError` included org query errors). The four main KPI cards — which only need simulation data — could not render until all queries resolved.

**After:** `computeQuickKPIs(sims)` derives the four primary metrics (totalSimulations, averageScore, passRate, activeAdvisors) from sims alone. `quickKpis` is available the instant the simulations query resolves. OverviewPage now uses `quickKpis ?? kpis` as its fallback chain.

**Time savings (cold cache, typical network):**
- Simulations arrive: ~1–3 s
- Activities arrive: ~0.3–0.8 s (fast, small)
- Members/Admins: ~0.5–1 s
- **Before:** KPIs visible after max(all four) = ~2–3 s
- **After:** KPIs visible after sims arrive = ~1–3 s (activities rarely bottleneck)
- **Org-dependent KPIs** (totalMembers, totalAdmins) fill in later with zero CLS

### 3.4 Below-Fold Widget Mount (P3)

All chart sections mounted at page load regardless of scroll position. On a typical 1080p monitor the fold cuts after the trend/donut row. The activity breakdown (horizontal bar chart), top performers list, and score distribution bar chart all mounted immediately, triggering Recharts layout calculations on hidden DOM nodes.

**After:** `useIntersectionObserver` defers mount until 120 px before entering the viewport. Lightweight skeleton placeholders preserve layout dimensions (preventing CLS).

---

## 4. Query Analysis

### Deduplication

TanStack Query v5 deduplicates concurrent requests with identical query keys automatically. All pages use the same key structure (`['simulations']`, `['activities']`, etc.) so data fetched by one page is immediately available to all others without re-fetch.

### Stale Times (configured in `queries.ts`)

| Dataset | staleTime | gcTime | Rationale |
|---------|-----------|--------|-----------|
| Simulations | 5 min | 15 min | Live session data |
| Activities | 24 hr | 48 hr | Nearly static metadata |
| Members | 2 hr | 4 hr | Org structure infrequent change |
| Admins | 2 hr | 4 hr | As above |
| Lines | 2 hr | 4 hr | Catalog, lazy-loaded |

### Cache Persistence

`localStorage` cache (key `sanfer-qc-v3`) is hydrated at module load before React renders. On warm sessions users see data on the very first paint. GC TTL matches the in-memory cache so stale localStorage entries are never restored past their useful lifetime.

---

## 5. Bundle Analysis

| Chunk | Size (gzip) | Notes |
|-------|-------------|-------|
| `vendor-charts` | 112.95 kB | Recharts — cannot be tree-shaken further |
| `vendor-router` | 53.43 kB | React Router v6 |
| `vendor-motion` | 37.78 kB | Framer Motion — used only in AIAssistant + AiBubble |
| `vendor-ai` | 36.14 kB | Google AI SDK — loaded only when panel opens |
| `index` (main) | 24.30 kB | Core app shell + OverviewPage |
| `AIAssistant` | 4.10 kB | Lazy chunk — deferred until user opens panel |

**Framer Motion note:** Both `AiBubble` and `AIAssistant` use Framer Motion (`AnimatePresence`, `motion.button/div`). `AiBubble` is always mounted, so `vendor-motion` is in the critical path. This is acceptable because the bubble animation is part of the essential UX. The alternative (CSS-only animations) would require a larger refactor with diminishing returns.

---

## 6. Remaining Opportunities (Not In Scope for This Pass)

| Item | Complexity | Estimated Gain |
|------|-----------|----------------|
| Server-side aggregation endpoint for overview KPIs | High (backend work) | ~60–80% payload reduction on cold load |
| Recharts tree-shakeable imports via `recharts/es` | Medium | ~20–30 kB gzip savings |
| `react-window` virtualization for SimulationsPage table | Low | Helps when >200 rows on page |
| Framer Motion → CSS `@keyframes` for `AiBubble` | Low | Remove 37 kB from critical path |
| Service Worker for offline caching | Medium | Eliminates cold-load network round-trips |
