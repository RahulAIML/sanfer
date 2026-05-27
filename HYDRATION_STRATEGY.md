# Sanfer Dashboard — Hydration Strategy

**Date:** 2026-05-27  
**Pattern:** Progressive hydration with staged rendering and intersection-based lazy mounting

---

## Overview

The dashboard hydrates in five discrete phases. Each phase depends only on the data available at that moment — no phase blocks on data it doesn't need.

```
Time →
│ Phase 1: Shell renders (instant — no data needed)
│ Phase 2: KPI cards populate (sims resolve — ~1–3 s cold, instant warm)
│ Phase 3: Trend + Pass/Fail donut render (same data as KPIs)
│ Phase 4: Below-fold sections mount when scrolled into view
│ Phase 5: AI panel initializes only when user clicks the button
└─────────────────────────────────────────────────────────────────
```

---

## Phase 1 — Instant Shell (0 ms)

**What renders:** navbar, sidebar, layout shell, filter bar, skeleton placeholders

**What does NOT render:** any chart, any KPI value, any data-driven content

**Implementation:**
- `Shell.tsx` renders synchronously — no async boundaries
- `OverviewPage` renders its skeleton (`isLoading = simsLoading`) while the first API response is in-flight
- `AiBubble` renders the floating button (pure CSS, zero data deps)
- `TopBar` and `Sidebar` are static layout components with no data subscriptions

**Key constraint:** The skeleton must preserve the exact same layout dimensions as the fully-hydrated state to avoid Cumulative Layout Shift (CLS).

---

## Phase 2 — KPI Cards (simulations query resolves)

**What renders:** 4 main KPI cards — Total Simulations, Average Score, Pass Rate, Active Advisors

**Data source:** `quickKpis` from `useDashboardData`

**Implementation:**
```ts
// analytics.ts
export function computeQuickKPIs(sims: Simulation[]): QuickKPIs {
  // O(N) — runs on sims only, no org data needed
  const passCount = sims.filter(s => s.Diagnostico_Final === 'si').length
  const advisors  = new Set(sims.map(s => s.Usuario_Nombre).filter(Boolean))
  // …
}

// useDashboardData.ts
const quickKpis = useMemo(
  () => (!simsLoading && !simsQ.isError ? computeQuickKPIs(sims) : null),
  [simsLoading, simsQ.isError, sims],
)
```

**OverviewPage fallback chain:**
```ts
const activeKpis = userFilterActive
  ? computeKPIs(filteredSims, activities, members, admins)   // user-filter re-derive
  : (kpis ?? quickKpis)                                      // full → quick fallback
```

**Result:** KPI cards show real data as soon as sims arrive — not waiting for activities, members, or admins.

---

## Phase 3 — Above-Fold Charts (same tick as KPIs)

**What renders:** Score trend (AreaChart), Pass/Fail distribution (PieChart/donut)

**Data source:** `trend` and `scoreDist` from `useDashboardData` — both derived from sims only

These render in the same React commit as Phase 2 since `trend` and `scoreDist` are memoized from the same `sims` array.

**The trend chart** receives `filteredTrend = trend ?? []` — the store-filtered trend points, already downsampled to max 60 data points via `computeTrend → downsample()`.

---

## Phase 4 — Below-Fold Lazy Sections (IntersectionObserver)

**What renders:** Activity breakdown bar chart, Top performers list, Score distribution bar chart

**Trigger:** IntersectionObserver — components mount when their sentinel `div` enters the viewport (with a 120 px `rootMargin` pre-load margin)

**Implementation (`useIntersectionObserver.ts`):**
```ts
export function useIntersectionObserver(
  options: IntersectionObserverInit = { rootMargin: '120px', threshold: 0 },
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, options)
    observer.observe(ref.current!)
    return () => observer.disconnect()
  }, [])
  return [ref, visible]
}
```

**Usage in OverviewPage:**
```tsx
const [belowFoldRef, belowFoldVisible] = useIntersectionObserver({ rootMargin: '120px' })
const [scoreSentRef, scoreVisible]     = useIntersectionObserver({ rootMargin: '80px' })

// Sentinel div — mounts charts when visible, shows skeleton when not
<div ref={belowFoldRef}>
  {belowFoldVisible ? <ActivityAndTopPerformers /> : <Placeholder height="h-80" />}
</div>
<div ref={scoreSentRef}>
  {scoreVisible ? <ScoreDistribution /> : <Placeholder height="h-72" />}
</div>
```

**Activity breakdown additional note:** If `activitiesLoading` is still `true` when the section scrolls into view, a skeleton replaces the chart until activities resolve. This covers the edge case where the user scrolls very fast on a slow connection.

---

## Phase 5 — AI Assistant Panel (user interaction)

**What renders:** Full chat panel with Framer Motion animation, message list, image upload UI, keyboard listeners

**Trigger:** User clicks the `AiBubble` floating button → Zustand sets `aiOpen = true`

**Implementation (Shell.tsx):**
```tsx
// AiBubble — always in DOM, ~200 B, zero data deps
<AiBubble />

// AIAssistantPanel — mounts only when aiOpen = true
{aiOpen && (
  <Suspense fallback={null}>
    <AIAssistantPanel />   // lazy chunk: 4.10 kB gzip
  </Suspense>
)}
```

**What defers until Phase 5:**
- `useDashboardData` subscription for AI context building
- `useState` for message history, input, thinking flag, attached image, image error
- `useRef` for DOM refs (bottomRef, fileInputRef, inputRef, abortRef)
- `useEffect` for auto-scroll, abort-on-close, focus-on-open
- Framer Motion `AnimatePresence` for panel slide-in animation
- Paste / keyboard event listener on the input field

**Panel unmounts on close:** `{aiOpen && …}` means when the user closes the panel, React unmounts it completely, freeing all state and event listeners. The next open is a fresh mount — message history is intentionally not persisted (privacy-safe, no stale AI context).

---

## Page-Level Lazy Loading

All non-overview pages use React `lazy()` with `Suspense`:

```ts
// App.tsx
const SimulationsPage    = lazy(() => import('./pages/SimulationsPage'))
const ConversationalPage = lazy(() => import('./pages/ConversationalPage'))
const LeaderboardPage    = lazy(() => import('./pages/LeaderboardPage'))
// …all 8 secondary pages
```

Each page chunk is only downloaded when the user first navigates to it. The `ChartSkeleton` fallback shows while the chunk loads, giving immediate visual feedback.

---

## Data Prefetch Strategy

```ts
// App.tsx — fires at module load, before React renders anything
queryClient.prefetchQuery({ queryKey: ['simulations'], … })  // ← critical path
queryClient.prefetchQuery({ queryKey: ['activities'],  … })  // ← fast, cached 24 h
queryClient.prefetchQuery({ queryKey: ['members'],     … })
queryClient.prefetchQuery({ queryKey: ['admins'],      … })
// lines NOT prefetched — lazy, only BusinessLinesPage needs it
```

**Rationale:** All four queries start simultaneously at module load (HTTP/2 multiplexed). By the time React renders the OverviewPage skeleton, the requests are already in-flight or complete. On warm sessions (localStorage cache < 30 min old), all data is injected synchronously — Phases 1–4 all happen in the same React commit.

---

## CLS (Cumulative Layout Shift) Prevention

Every below-fold placeholder preserves the exact height of the chart it replaces:

| Section | Placeholder height | Chart height |
|---------|-------------------|--------------|
| Activity breakdown + Top performers | `h-80` (320 px) | Same |
| Score distribution | `h-72` (288 px) | `h-56` card + padding ≈ 288 px |

Skeleton `div`s use the `skeleton` CSS class (shimmer animation) to signal loading state without layout jump.
