# Sanfer Dashboard — Responsive Audit

> Mobile-first audit and fix log for the Sanfer dashboard.  
> Breakpoints: `sm` = 640px, `md` = 768px, `lg` = 1024px, `xl` = 1280px

---

## 1. Viewport Coverage

| Breakpoint | Device class | Status |
|---|---|---|
| < 640px | Mobile portrait | ✅ Verified |
| 640–767px | Mobile landscape / small tablet | ✅ Verified |
| 768–1023px | Tablet | ✅ Verified |
| 1024–1279px | Small laptop | ✅ Verified |
| ≥ 1280px | Desktop | ✅ Verified |

---

## 2. Layout System

### Sidebar

| Behavior | Implementation |
|---|---|
| Desktop (≥ 1024px) | Fixed left sidebar, collapsible to icon-only mode (`w-64` → `w-16`) |
| Mobile (< 1024px) | Drawer overlay via Framer Motion `x` translate, backdrop overlay |
| Collapse toggle | Hamburger in header, persisted to Zustand `sidebarOpen` state |
| Active indicator | Animated `layoutId="activeNav"` pill using Framer Motion shared layout |

### Main content area

- Uses `ml-0 lg:ml-64` (or `lg:ml-16` when collapsed) CSS transition
- Inner padding: `px-4 py-4 sm:px-6 sm:py-6` — tighter on mobile, comfortable on desktop
- Max-width uncapped — fills available space

---

## 3. Component-Level Audit

### 3.1 KPI Cards (OverviewPage)

| Issue | Fix applied |
|---|---|
| 4-column grid overflows on mobile | `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4` — 2 cols on mobile, 4 on desktop |
| Large number font size clips on small screens | `text-2xl sm:text-3xl` responsive sizing |
| Icon + label truncation | `min-w-0` + `truncate` on label containers |

### 3.2 Charts (Recharts)

| Issue | Fix applied |
|---|---|
| Charts overflow container on mobile | All charts wrapped in `ResponsiveContainer width="100%" height="100%"` |
| Y-axis labels cut off on narrow screens | `width={120}` with `tickFormatter` truncating at 16 chars |
| Bar chart text overlap | `fontSize: 10` on axis ticks, 10px minimum |
| Tooltip overflow viewport edge | `wrapperStyle={{ zIndex: 50 }}` prevents clipping; Recharts handles positioning |

### 3.3 Data Tables

| Component | Issue | Fix |
|---|---|---|
| BusinessLinesPage table | Horizontal overflow on mobile | `overflow-x-auto` wrapper on table container |
| AdvisorsPage table | Same | Same pattern |
| Column headers | Long labels break layout | `whitespace-nowrap` on all `<th>` cells |
| Cell truncation | Long names overflow | `truncate max-w-[180px]` on name cells |

### 3.4 BusinessLinesPage

| Issue | Fix applied |
|---|---|
| 3 KPI cards in a row too wide on mobile | `grid-cols-1 sm:grid-cols-3` |
| Two chart panels side by side too narrow on tablets | `grid-cols-1 lg:grid-cols-2` — stacks on tablet, side-by-side on desktop |
| Radar chart labels overlap on small screens | `outerRadius="70%"` + 10px tick font |

### 3.5 Sidebar Navigation

| Issue | Fix applied |
|---|---|
| Nav item text invisible when sidebar collapsed | Icons remain, text hidden via `opacity-0 w-0 overflow-hidden` in collapsed state |
| Touch targets too small on mobile | Nav items: `py-2.5 px-3` minimum, ≥ 44px effective touch height |
| Logo area clips on collapsed sidebar | Logo swap: full wordmark vs icon-only controlled by `isOpen` state |

### 3.6 Header Bar

| Issue | Fix applied |
|---|---|
| Language switcher + theme toggle crowd on narrow screens | Grouped in `flex items-center gap-2` with `shrink-0` — never wraps |
| Page title truncates | `truncate` class with max-width |

### 3.7 AI Assistant Panel

| Issue | Fix applied |
|---|---|
| Full-width on mobile obscures content | Panel width: `w-full sm:w-96` — full width on mobile, fixed 384px on larger |
| Panel height exceeds viewport | `max-h-[calc(100vh-4rem)]` with `overflow-y-auto` scroll |
| Input area | Fixed to bottom of panel with `sticky bottom-0` |
| Backdrop on mobile | Semi-transparent overlay prevents interaction with content below |

### 3.8 ReportsPage

| Issue | Fix applied |
|---|---|
| Summary stat grid too wide on mobile | `grid-cols-2 lg:grid-cols-4` |
| Export button cards stack correctly | `grid-cols-1 md:grid-cols-2` |
| Report template cards | Same 2-col grid |

---

## 4. Typography Scale

| Context | Mobile | Desktop |
|---|---|---|
| Page titles | `text-xl` (20px) | `sm:text-2xl` (24px) |
| Section headers | `text-base` | `text-lg` |
| Card values (KPIs) | `text-2xl` | `sm:text-3xl` |
| Body / descriptions | `text-xs` (12px) | `text-sm` (14px) |
| Table cells | `text-sm` (14px) | `text-sm` |
| Chart axis labels | 10px (via `fontSize` prop) | 10–11px |

---

## 5. Touch & Accessibility

| Check | Status |
|---|---|
| Minimum touch target size (44×44px) | ✅ All interactive elements meet this |
| Focus rings | ✅ Tailwind `focus-visible:ring-2` on buttons and inputs |
| Color contrast (WCAG AA) | ✅ Slate-50 text on dark backgrounds exceeds 4.5:1 |
| Disabled state styling | ✅ `disabled:opacity-40 disabled:cursor-not-allowed` on export buttons |
| Error states visible | ✅ Red/warning color coding on low scores, error boundary with retry |

---

## 6. Known Limitations

| Item | Notes |
|---|---|
| Radar chart on very narrow screens (< 320px) | PolarAngleAxis labels may overlap — affects legacy small phones only |
| Long line names in table | Truncated at 180px — full name shown in chart tooltips |
| No pinch-to-zoom prevention | `viewport` meta does not set `user-scalable=no` — intentionally allows zoom for accessibility |
