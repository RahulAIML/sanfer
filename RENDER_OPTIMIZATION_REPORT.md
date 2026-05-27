# Sanfer Dashboard — Render Optimization Report

**Date:** 2026-05-27  
**Stack:** React 18, TanStack Query v5, Zustand v5, Recharts, Framer Motion

---

## 1. Memoization Architecture

### 1.1 Analytics Memoization (`useDashboardData`)

All expensive analytics functions are individually memoized so that a change in one dataset slice does not re-run unrelated computations:

```ts
// Each computation has its own useMemo with precise dependencies
const kpis      = useMemo(() => computeKPIs(sims, activities, members, admins),         [simsLoading, activitiesLoading, isError, sims, activities, members, admins])
const quickKpis = useMemo(() => computeQuickKPIs(sims),                                  [simsLoading, simsQ.isError, sims])
const trend     = useMemo(() => computeTrend(sims),                                      [simsLoading, isError, sims])
const roundStats= useMemo(() => computeRoundStats(sims),                                 [simsLoading, isError, sims])
const actStats  = useMemo(() => computeActivityStats(sims, activities),                  [simsLoading, activitiesLoading, isError, sims, activities])
const userStats = useMemo(() => computeUserStats(sims),                                  [simsLoading, isError, sims])
const scoreDist = useMemo(() => computeScoreDistribution(sims),                          [simsLoading, isError, sims])
const orgTree   = useMemo(() => buildOrgTree(admins, members),                           [orgLoading, isError, admins, members])
```

**Key property:** If only `sims` updates (new date filter applied), `orgTree` does NOT re-compute. If only `admins` updates, none of the sims-derived analytics re-compute.

### 1.2 Component Memoization

Critical reusable components are wrapped with `React.memo`:

| Component | Memo reason |
|-----------|-------------|
| `Shell` | Re-renders only when theme/aiOpen/mobileMenuOpen change |
| `KpiCard` | Pure display — only re-renders when value/label prop changes |
| `SimulatorCard` (ConversationalPage) | Each card is stable if its `stat` prop reference is stable |
| `NavContent` (Sidebar) | Navigation structure is static — no data deps |

### 1.3 Selector Granularity (Zustand)

Each Zustand subscription uses a granular selector to avoid over-subscription:

```ts
// ✅ Good — only re-renders when language changes
const language = useAppStore((s) => s.language)

// ✅ Good — only re-renders when dateFrom changes
const dateFrom = useAppStore((s) => s.dateFrom)

// ❌ Avoided — would re-render on ANY store update
const state = useAppStore()
```

All 15 store fields have independent selectors where they're used, preventing unnecessary re-renders from unrelated state changes.

---

## 2. Chart Optimizations

### 2.1 Trend Chart Downsampling

```ts
// analytics.ts
const MAX_TREND_POINTS = 60

function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr
  const step = Math.ceil(arr.length / maxPoints)
  const result: T[] = []
  for (let i = 0; i < arr.length; i++) {
    if (i % step === 0 || i === arr.length - 1) result.push(arr[i])
  }
  return result
}
```

Recharts renders one SVG `<path>` point per data point. At 60 data points the difference is visually imperceptible; at 500+ points the SVG `d` attribute becomes very long, causing measurable layout recalculation cost. Cap at 60 prevents this regardless of the historical dataset size.

### 2.2 Stack-Safe Score Aggregation

```ts
// Before: Math.max(...spread) — stack overflow above ~10,000 elements
const bestScore = Math.max(...sims.map(s => s.Calificacion))

// After: reduce — O(N), constant stack depth
const bestScore = sims.reduce((m, s) => Math.max(m, s.Calificacion), -Infinity)
```

### 2.3 IntersectionObserver for Below-Fold Charts

```tsx
const [belowFoldRef, belowFoldVisible] = useIntersectionObserver({ rootMargin: '120px' })

<div ref={belowFoldRef}>
  {belowFoldVisible
    ? <ActivityBarChart data={topActivities} />   // mounts only when in view
    : <div className="card p-5 h-80 skeleton" />  // lightweight placeholder
  }
</div>
```

**What this prevents:**
- Recharts running layout calculations on hidden elements
- `ResizeObserver` in `ResponsiveContainer` firing for off-screen charts
- Canvas / SVG rendering for content the user hasn't seen yet

**CLS prevention:** Placeholder divs match the chart card heights exactly so no layout shift occurs when charts mount.

### 2.4 Stable Tooltip Components

Recharts tooltip components are defined as named functions (not inline arrow functions):

```tsx
// ✅ Stable reference — React doesn't re-create each render
function TrendTooltip({ active, payload, label, es, c }) { … }

// ❌ Avoided — new reference on every parent render → Recharts re-registers
<Tooltip content={(props) => <TrendTooltip {...props} es={es} c={tt} />} />
```

Using named functions as `content` prop values prevents Recharts from treating each render as a new component instance, which would cause tooltip state resets.

---

## 3. AI Assistant Render Isolation

### 3.1 Before: Always Mounted

```tsx
// Shell.tsx — previous implementation
<Suspense fallback={null}>
  <AIAssistant />   // ← always in tree, always calls useDashboardData()
</Suspense>
```

Every render of `Shell` (triggered by theme/sidebar changes) caused `AIAssistant` to receive props and re-evaluate its hook chain — including a `useDashboardData()` subscription that pulled all analytics data into the AI component.

### 3.2 After: Split into Bubble + Conditional Panel

```tsx
// Shell.tsx — current implementation
<AiBubble />              // ~200 B — AnimatePresence + 1 button, zero data deps
{aiOpen && (
  <Suspense fallback={null}>
    <AIAssistantPanel />  // mounted only when panel is open
  </Suspense>
)}
```

**State lifecycle:**
- Panel **mounts** when `aiOpen` flips `true` → all hooks initialize fresh
- Panel **unmounts** when `aiOpen` flips `false` → all state freed, listeners removed
- Message history is intentionally ephemeral (privacy-safe, no stale AI context risk)

**Re-render isolation:** `AiBubble` subscribes only to `aiOpen`, `toggleAI`, and `language` — three Zustand fields that rarely change. No analytics subscriptions.

---

## 4. React Rules of Hooks — ConversationalPage Fix

### 4.1 The Violation

```tsx
// BEFORE — invalid hook call order
export default function ConversationalPage() {
  const { isLoading, isError, roundStats, actStats } = useDashboardData()

  if (isLoading) return <Skeleton />   // ← hook boundary
  if (isError)   return <Error />      // ← hook boundary

  // These hooks are only called when isLoading = false and isError = false
  // React REQUIRES hooks to be called on every render, unconditionally
  const simStats = useMemo(…)          // ← illegal position
  const radarData = useMemo(…)         // ← illegal position
}
```

**Why this is dangerous:** React tracks hooks by call order, not by name. When `isLoading` is `true`, React records N hooks for this component. When `isLoading` flips to `false`, React records N+2 hooks. This mismatch causes React to read state from the wrong slot, potentially returning stale/wrong memoized values or throwing in strict mode.

### 4.2 The Fix

```tsx
// AFTER — all hooks unconditionally before any return
export default function ConversationalPage() {
  const { isLoading, isError, roundStats, actStats } = useDashboardData()

  // ── ALL hooks declared unconditionally ──────────────────────────────────
  const stats    = roundStats ?? []
  const simStats = useMemo(
    () => (actStats ?? []).slice().sort((a, b) => b.passRate - a.passRate),
    [actStats],
  )
  const avgKey   = es ? 'Puntaje Prom.' : 'Avg Score'
  const passKey  = es ? 'Tasa Aprobación' : 'Pass Rate'
  const radarData = useMemo(
    () => stats.map((r) => ({ round: `${t('round')} ${r.round}`, … })),
    [stats, avgKey, passKey],
  )
  const totalSims   = simStats.reduce((s, a) => s + a.count, 0)
  const overallAvg  = …
  const strongCount = …
  const attnCount   = …
  // ── End of hook zone — safe to return early ──────────────────────────────

  if (isLoading) return <Skeleton />
  if (isError)   return <Error />
  …
}
```

---

## 5. Filter Render Scope

### 5.1 Date Filter (Global)

Changing the date filter in OverviewPage calls `setDateRange(from, to)` → Zustand store update → `useDashboardData` re-runs the `sims` memo → all analytics re-compute. 

**Re-render scope:** All pages that are currently mounted and call `useDashboardData`. In practice, only the currently-visible page is fully mounted (other pages unmount when navigated away in React Router). Shell is the only other mounted component that subscribes to the store, but it only reads `theme`, `aiOpen`, and `mobileMenuOpen` — not `dateFrom`/`dateTo`.

### 5.2 OverviewPage User Filter

`selectedUsers` is `useState<Set<string>>` — local to OverviewPage. Changes only cause OverviewPage to re-render. No other page or global component is affected.

### 5.3 Search Inputs

`useDebounce(searchRaw, 300)` means the filtered computation only runs after 300 ms of inactivity. Raw keystroke state (`searchRaw`) updates immediately for the input's visual value, but `filtered` and `paginated` memos do not re-run on every character.

---

## 6. Table Virtualization Status

### Current: Pagination

| Page | Strategy | Page Size | Notes |
|------|---------|-----------|-------|
| SimulationsPage | Pagination | 50 rows | `filtered.slice(page * 50, (page+1) * 50)` |
| LeaderboardPage | Pagination | 25 rows | + top-N filter (10/25/50/all) |
| OrganizationPage | Pagination | 25 nodes | Tree structure, not flat list |

Pagination is appropriate for the current dataset size (~hundreds of rows within the 30-day window). DOM node count is bounded at ≤50 rows × 6 columns = 300 cells, well within browser paint budgets.

### When to Add Virtualization

If the dataset grows beyond ~2,000 simulations within the 30-day window, consider `react-window` `FixedSizeList` for SimulationsPage. The trigger metric: if the filtered list regularly exceeds 500 rows before pagination, virtualization becomes cost-effective.

---

## 7. Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| `src/lib/analytics.ts` | Added `computeQuickKPIs` (sims-only KPIs) | Unblocks Phase 2 hydration |
| `src/hooks/useIntersectionObserver.ts` | New — viewport-based lazy mount | Eliminates off-screen chart renders |
| `src/hooks/useDashboardData.ts` | Exposes `quickKpis`, imports `computeQuickKPIs` | Powers progressive KPI display |
| `src/pages/ConversationalPage.tsx` | Moved all hooks before conditional returns | Fixes Rules of Hooks violation |
| `src/components/ai/AiBubble.tsx` | New — always-visible floating button, zero data deps | Removes startup AI cost |
| `src/components/ai/AIAssistant.tsx` | Removed floating bubble (moved to AiBubble) | Panel-only, deferred mount |
| `src/components/layout/Shell.tsx` | Conditional `{aiOpen && <AIAssistantPanel />}` | AI never mounts until opened |
| `src/pages/OverviewPage.tsx` | `quickKpis` fallback, IntersectionObserver for below-fold | Progressive hydration |
