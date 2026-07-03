# UnVibe UI Redesign — Comprehensive Execution Plan

**Generated:** 2026-07-03
**Source:** UI-AUDIT.md findings + impeccable design philosophy
**Scope:** `apps/web/` — full frontend redesign
**Strategy: Goal-backward from audit truths → atomic commits**

---

## Dependency Map

```
Phase 1 (Tokens) ──► Phase 2 (Components) ──► Phase 3 (Eyebrow Removal)
      │                                              │
      │                                              │
      ▼                                              ▼
Phase 5 (Hardcoded Colors)                  Phase 4 (Copy + Surface Grid)
      │                                              │
      │                                              │
      ▼                                              ▼
Phase 6 (Sign-out Dialog + Data Wiring)◄─────────────┘
```

**Parallel groups:** Phase 4 and Phase 5 can run in either order after Phase 1+2 complete. Phase 6 depends on all previous phases.

---

## Phase 1: Design Token Foundation

**Goal:** Establish standardized semantic color tokens and surface utilities that all downstream phases consume. Remove banned `surface-grid` utility.

**Entry criteria:** Current `globals.css` and `tailwind.config.ts` are the sole source of truth for the design token system.

**Exit criteria:** `surface-grid` removed, standardized backdrop opacity levels (2 levels), semantic success/warning/destructive tokens defined as CSS variables, `surface` utility class available.

**Files modified:**
- `apps/web/src/app/globals.css`
- `apps/web/tailwind.config.ts`

### Changes

#### `apps/web/src/app/globals.css`

1. **Remove `surface-grid` utility class** (lines 82-88) — delete entire `@layer utilities` block containing `.surface-grid`.

2. **Add semantic color tokens** as CSS variables in `:root` and `.dark`:

   ```css
   /* Add after --ring in :root */
   --success: 152 76% 40%;        /* green */
   --success-foreground: 0 0% 100%;
   --warning: 35 92% 55%;         /* amber */
   --warning-foreground: 0 0% 100%;
   --info: 188 91% 35%;           /* same as primary */
   --info-foreground: 190 90% 98%;

   /* Add in .dark */
   --success: 152 76% 36%;
   --success-foreground: 0 0% 100%;
   --warning: 35 92% 50%;
   --warning-foreground: 0 0% 100%;
   ```

3. **Add surface utility** for solid background replacement of `surface-grid`:

   ```css
   .surface {
     @apply bg-background;
   }
   ```

4. **Standardize backdrop opacity levels** — audit shows 5 variants (`/60`, `/80`, `/85`, `/95`, `/50`). Standardize to 2:
   - `/60` — used most (7+ locations) → keep as standard surface opacity
   - `/90` — new standard for elevated/contained surfaces

   Add comment documenting: `/* Opacity levels: bg-*/60 for surfaces, bg-*/90 for containers */`

#### `tailwind.config.ts`

Add semantic color mappings:

```typescript
success: {
  DEFAULT: "hsl(var(--success))",
  foreground: "hsl(var(--success-foreground))",
},
warning: {
  DEFAULT: "hsl(var(--warning))",
  foreground: "hsl(var(--warning-foreground))",
},
```

### Verification

```bash
# 1. surface-grid class removed
grep -c "surface-grid" src/app/globals.css && echo "FAIL: surface-grid still present" || echo "PASS: surface-grid removed"

# 2. New tokens exist
grep -c "success" src/app/globals.css | grep -q "2" && echo "PASS: success tokens found" || echo "FAIL: success tokens missing"
grep -c "warning" src/app/globals.css | grep -q "2" && echo "PASS: warning tokens found" || echo "FAIL: warning tokens missing"

# 3. Tailwind config has success/warning
grep -c "success:" tailwind.config.ts && echo "PASS: success in tailwind config" || echo "FAIL: success missing from tailwind config"

# 4. Build compiles
npm run build -- --no-lint 2>&1 | tail -5
```

### Atomic commit message

```
feat(design-tokens): add semantic success/warning colors, remove surface-grid

- Add --success / --warning CSS variables to :root and .dark
- Map success/warning in tailwind.config.ts
- Remove banned surface-grid utility class
- Add surface utility for solid bg replacement
- Document standardized opacity levels (bg-*/60, bg-*/90)
```

---

## Phase 2: Component Library Fixes (Badge + PageHeader)

**Goal:** Fix `Badge` component to use theme tokens instead of hardcoded emerald/amber/red. Remove eyebrow badge pattern from `PageHeader` component API. These are the shared primitives consumed by every page.

**Entry criteria:** Phase 1 complete (success/warning tokens available). No other component depends on hardcoded Badge variants.

**Exit criteria:** Badge `success`/`warning`/`destructive` variants use CSS variable tokens. PageHeader accepts only `title` + `description` + `action` (no `eyebrow` prop). All existing callers will need updates — those are handled in Phase 3.

**Files modified:**
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/app/page-header.tsx`

### Changes

#### `apps/web/src/components/ui/badge.tsx`

Replace hardcoded string values in `variants` record:

```typescript
// Before (lines 10-12):
success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
destructive: "border-red-500/30 bg-red-500/10 text-red-400",

// After:
success: "border-success/30 bg-success/10 text-success",
warning: "border-warning/30 bg-warning/10 text-warning",
destructive: "border-destructive/30 bg-destructive/10 text-destructive-foreground",
```

This ensures Badge variants respond to theme changes and pass WCAG contrast.

#### `apps/web/src/components/app/page-header.tsx`

Remove eyebrow badge pattern entirely:

1. **Remove `eyebrow` prop** from the interface
2. **Remove Badge import** (no longer needed)
3. **Remove the conditional badge render block** (lines 17-21)
4. **Simplify component** — only renders title + optional description + optional action

```typescript
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
```

### Verification

```bash
# 1. Badge no longer has hardcoded emerald/amber/red
! grep -q "emerald\|amber\|red" src/components/ui/badge.tsx && echo "PASS: no hardcoded colors" || echo "FAIL: hardcoded colors remain"

# 2. Badge uses theme tokens
grep -q "bg-success" src/components/ui/badge.tsx && echo "PASS: uses success token" || echo "FAIL: missing success token"

# 3. PageHeader has no eyebrow
! grep -q "eyebrow" src/components/app/page-header.tsx && echo "PASS: eyebrow removed from PageHeader" || echo "FAIL: eyebrow still in PageHeader"

# 4. Build compiles
npm run build -- --no-lint 2>&1 | tail -5
```

### Atomic commit message

```
feat(components): refactor Badge to theme tokens, remove PageHeader eyebrow

- Replace hardcoded emerald/amber/red in Badge with success/warning/destructive CSS variable tokens
- Remove eyebrow prop, Badge import from PageHeader
- PageHeader now only renders title + description + action
```

---

## Phase 3: Remove Eyebrow Pattern + Replace Uppercase Labels

**Goal:** Eliminate all eyebrow badge call sites (6 pages) and all `uppercase tracking-[0.18em]` / `uppercase tracking-[0.22em]` patterns across the codebase. This is the largest visual quality fix per the audit.

**Entry criteria:** Phase 2 complete (PageHeader no longer accepts `eyebrow` prop). The TypeScript compiler will error on all eyebrow usages — these are the fixes.

**Exit criteria:** Zero occurrences of `eyebrow=`, zero `tracking-[0.18em]`, zero `tracking-[0.22em]` in the codebase. All uppercase label patterns replaced with appropriate alternatives.

**Files modified (12 files):**

| File | Change |
|------|--------|
| `src/app/app/dashboard/page.tsx` | Remove `eyebrow="dashboard"` from PageHeader |
| `src/app/app/tracks/page.tsx` | Remove `eyebrow="tracks"` (2 call sites) |
| `src/app/app/war-room/page.tsx` | Remove `eyebrow="war room"` |
| `src/app/app/blindspot-map/page.tsx` | Remove `eyebrow="blindspot map"` (2 call sites) |
| `src/app/app/profile/page.tsx` | Remove `eyebrow="profile"` |
| `src/components/app/app-shell.tsx` | Replace `uppercase tracking-[0.22em]` on user.email (line 69) with normal `text-xs text-muted-foreground` |
| `src/components/features/code-editor.tsx` | Replace `uppercase tracking-[0.18em]` on language label (line 23) with `text-xs text-muted-foreground` |
| `src/components/features/diff-viewer.tsx` | Replace `uppercase tracking-[0.18em]` on header labels (line 7) with `text-xs text-muted-foreground font-medium` |
| `src/app/app/blindspot-map/page.tsx` | Replace `uppercase tracking-[0.18em]` on "Evidence" (line 67) and "Next action" (line 73) with normal `text-xs font-medium` |
| `src/app/page.tsx` | Replace `uppercase tracking-[0.22em]` on "sample module" (line 77) with normal `text-xs text-muted-foreground` |
| `src/app/page.tsx` | Remove hero metric numbering `0{index + 1}` (lines 98) — the audit flags "01/02/03" as banned AI slop pattern |

Additional: Remove `Badge` import from `page-header.tsx` (already done in Phase 2) and any remaining `Badge` imports that were only used for eyebrow — check each file.

### Detailed changes per file

#### `src/app/app/dashboard/page.tsx` (line 66)
```diff
- <PageHeader eyebrow="dashboard" title="Training status" ... />
+ <PageHeader title="Training status" ... />
```

#### `src/app/app/tracks/page.tsx` (lines 19, 36)
Two PageHeader call sites, both need `eyebrow="tracks"` removed.

#### `src/app/app/war-room/page.tsx` (line 51)
Remove `eyebrow="war room"`.

#### `src/app/app/blindspot-map/page.tsx` (lines 29, 48)
Remove `eyebrow="blindspot map"` from both PageHeader call sites.

Also lines 67, 73:
```diff
- <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Evidence</p>
+ <p className="text-xs font-medium text-muted-foreground">Evidence</p>

- <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next action</p>
+ <p className="text-xs font-medium text-muted-foreground">Next action</p>
```

#### `src/app/app/profile/page.tsx` (line 47)
Remove `eyebrow="profile"`.

#### `src/components/app/app-shell.tsx` (line 69)
```diff
- <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">{user.email}</p>
+ <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
```

#### `src/components/features/code-editor.tsx` (line 23)
```diff
- <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{language}</span>
+ <span className="font-mono text-xs text-muted-foreground">{language}</span>
```

#### `src/components/features/diff-viewer.tsx` (line 7)
```diff
- <div className="grid grid-cols-2 border-b border-border px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
+ <div className="grid grid-cols-2 border-b border-border px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
```

#### `src/app/page.tsx` (line 77)
```diff
- <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">sample module</p>
+ <p className="font-mono text-xs text-muted-foreground">Sample module</p>
```

Line 98 — remove hero metric numbering:
```diff
- <div className="flex items-center justify-between gap-3">
-   <p className="font-medium">{signal.label}</p>
-   <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
- </div>
+ <p className="font-medium">{signal.label}</p>
```

Also note: The `page.tsx` landing page badge at line 51-52 uses `Badge variant="outline"` which is fine — it's not an eyebrow (it's a subtitle badge below the nav). Keep as-is.

### Verification

```bash
# 1. Zero eyebrow props in codebase
! grep -r "eyebrow=" src/ --include="*.tsx" && echo "PASS: no eyebrow props" || echo "FAIL: eyebrow props remain"

# 2. Zero tracking-[0.18em] patterns
! grep -r "tracking-\[0\.18em\]" src/ --include="*.tsx" && echo "PASS: no 0.18em tracking" || echo "FAIL: 0.18em tracking remains"

# 3. Zero tracking-[0.22em] patterns
! grep -r "tracking-\[0\.22em\]" src/ --include="*.tsx" && echo "PASS: no 0.22em tracking" || echo "FAIL: 0.22em tracking remains"

# 4. Zero hero metric numbering
! grep -r "0{index" src/ --include="*.tsx" && echo "PASS: no hero metrics" || echo "FAIL: hero metrics remain"

# 5. Build compiles (this is critical — PageHeader API changed)
npm run build -- --no-lint 2>&1 | tail -10
```

### Atomic commit message

```
fix(ui): remove all eyebrow badge patterns and uppercase tracking labels

BREAKING CHANGE: PageHeader `eyebrow` prop removed (12 call sites updated)
- Remove eyebrow="..." from dashboard, tracks, war-room, blindspot-map, profile
- Replace uppercase tracking-[0.18em]/[0.22em] labels with normal text in:
  app-shell, code-editor, diff-viewer, blindspot-map evidence/next-action labels
- Remove hero metric numbering (01/02/03) from landing page sample module card
- Fix casing: "sample module" → "Sample module"
```

---

## Phase 4: Copy Fixes + Surface Grid Replacement + Hero Badge Fix

**Goal:** Replace all developer-facing copy with production-appropriate text. Replace banned `surface-grid` backgrounds with solid backgrounds. Fix landing page hero badge.

**Entry criteria:** Phase 1 complete (surface utility available). Phase 2+3 can be parallel or sequential — no hard dependency. Surface-grid CSS class removed in Phase 1; this phase replaces the HTML class strings.

**Exit criteria:** Zero `surface-grid` class names in any TSX file. Zero developer-facing copy strings. Landing page hero badge uses themed colors.

**Files modified (5 files):**

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Copy line 64, badge colors lines 51-52, surface-grid line 24 |
| `src/app/app/dashboard/page.tsx` | Copy line 68 |
| `src/app/app/war-room/page.tsx` | Copy line 53 |
| `src/app/auth/signin/page.tsx` | surface-grid line 45 |
| `src/app/auth/signup/page.tsx` | surface-grid line 50 |

### Detailed changes

#### `src/app/page.tsx`

**Surface-grid (line 24):**
```diff
- <section className="surface-grid relative min-h-screen border-b border-border">
+ <section className="surface relative min-h-screen border-b border-border">
```

**Developer copy (line 64):**
```diff
- Open mock dashboard
+ Open dashboard
```

**Hero badge (lines 51-52)** — currently uses ad-hoc styling instead of pure Badge variant:
```diff
- <Badge variant="outline" className="mb-6 border-primary/40 bg-primary/10 text-primary">
+ <Badge variant="outline" className="mb-6 text-primary">
```
(The `border-primary/40 bg-primary/10` is redundant when Badge outline already uses proper border/foreground theme colors.)

#### `src/app/app/dashboard/page.tsx`

**Developer copy (line 68):**
```diff
- description="Mock data mirrors the future API shape while the backend catches up."
+ description="Track your training progress, streaks, and leaderboard ranking."
```

#### `src/app/app/war-room/page.tsx`

**Developer copy (line 53):**
```diff
- description="Socket.io client wiring is present with a mock live feed so the room works without backend events."
+ description="Compete in live coding sessions and defend your reasoning against peers."
```

#### `src/app/auth/signin/page.tsx` (line 45)
```diff
- <main className="surface-grid flex min-h-screen items-center justify-center p-4">
+ <main className="flex min-h-screen items-center justify-center bg-background p-4">
```

#### `src/app/auth/signup/page.tsx` (line 50)
```diff
- <main className="surface-grid flex min-h-screen items-center justify-center p-4">
+ <main className="flex min-h-screen items-center justify-center bg-background p-4">
```

### Verification

```bash
# 1. Zero surface-grid in TSX
! grep -r "surface-grid" src/ --include="*.tsx" && echo "PASS: no surface-grid in TSX" || echo "FAIL: surface-grid remains"

# 2. Zero developer copy
! grep -r "mock" src/app/app/dashboard/page.tsx && echo "PASS: no mock in dashboard" || echo "FAIL: mock remains in dashboard"
! grep -r "Socket.io\|socket.io" src/app/app/war-room/page.tsx && echo "PASS: no socket.io in war room" || echo "FAIL: socket.io remains in war room"
! grep -r "mock dashboard" src/app/page.tsx && echo "PASS: no mock dashboard" || echo "FAIL: mock dashboard remains"

# 3. No border-primary/40 bg-primary/10 on badge
grep -q "border-primary/40 bg-primary/10" src/app/page.tsx && echo "FAIL: ad-hoc badge styling remains" || echo "PASS: badge uses clean variant"

# 4. Build compiles
npm run build -- --no-lint 2>&1 | tail -5
```

### Atomic commit message

```
fix(copy): replace developer-facing text, remove surface-grid from pages

- "Open mock dashboard" → "Open dashboard" on landing page
- Dashboard description now user-facing value proposition
- War Room description now user-facing (no socket.io internals)
- Replace surface-grid with surface utility on landing page
- Replace surface-grid with bg-background on signin/signup pages
- Clean up ad-hoc badge styling on landing hero badge
```

---

## Phase 5: Hardcoded Color Migration + Typography Fixes

**Goal:** Replace all 8+ hardcoded inline color values with theme CSS variable tokens. Fix `text-[11px]` on mobile nav. Fix WCAG contrast issue on `text-muted-foreground/60`. Fix `min-h-[400px]` arbitrary value. Standardize backdrop opacity levels across app shell.

**Entry criteria:** Phase 1 complete (success/warning tokens available). Phase 2 complete (Badge already fixed — this phase handles the remaining feature component color bypasses).

**Exit criteria:** Zero `text-emerald-*`, `text-amber-*`, `text-red-*`, `text-cyan-*`, `bg-emerald-*`, `bg-red-*`, `bg-black` hardcoded colors in feature components. Zero `text-[11px]`. Zero `text-muted-foreground/60`. Zero `min-h-[400px]`. Backdrop opacities standardized to `/60` and `/90` only.

**Files modified (6 files):**

| File | Hardcoded Value | Replacement |
|------|----------------|-------------|
| `src/components/features/quiz-ui.tsx` | `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` (line 16) | `border-success/30 bg-success/10 text-success` |
| `src/components/features/quiz-ui.tsx` | `border-emerald-500/40 bg-emerald-500/10 text-emerald-300` (line 36) | `border-success/40 bg-success/10 text-success` |
| `src/components/features/diff-viewer.tsx` | `bg-emerald-500/10` (line 17) | `bg-success/10` |
| `src/components/features/diff-viewer.tsx` | `bg-red-500/10` (line 18) | `bg-destructive/10` |
| `src/components/features/streak-tracker.tsx` | `text-amber-400` (line 12) | `text-warning` |
| `src/app/page.tsx` | `bg-black` (line 106) | `bg-card` (uses card bg, matches parent theme) |
| `src/app/page.tsx` | `text-cyan-100` (line 106) | `text-foreground` |
| `src/app/page.tsx` | `text-amber-300` (line 108) | `text-warning` |
| `src/app/page.tsx` | `text-emerald-300` (line 111) | `text-success` |
| `src/components/app/error-fallback.tsx` | `min-h-[400px]` (line 8) | `min-h-64` |
| `src/components/app/app-shell.tsx` | `text-[11px]` (line 95) | `text-xs` |
| `src/components/features/irs-radar-chart.tsx` | `text-muted-foreground/60` (line 16) | `text-muted-foreground` |

**Backdrop opacity standardization in `app-shell.tsx`:**

Currently:
- Sidebar: `bg-card/80 backdrop-blur` → `bg-card/90 backdrop-blur` (elevated surface)
- Header: `bg-background/85 backdrop-blur` → `bg-background/90 backdrop-blur`
- Mobile nav: `bg-card/95 backdrop-blur` → `bg-card/90 backdrop-blur` (unify with sidebar)

This reduces from 3 different backdrop opacities (80, 85, 95) to 1 (90), eliminating the "5 opacity levels" concern from the audit.

### Detailed changes

#### `src/components/features/quiz-ui.tsx`

Line 16 (complete state):
```diff
- <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
+ <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
```

Line 36 (correct answer state):
```diff
- correct && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
+ correct && "border-success/40 bg-success/10 text-success",
```

#### `src/components/features/diff-viewer.tsx`

Lines 17-18:
```diff
- line.type === "add" && "bg-emerald-500/10",
- line.type === "remove" && "bg-red-500/10",
+ line.type === "add" && "bg-success/10",
+ line.type === "remove" && "bg-destructive/10",
```

#### `src/components/features/streak-tracker.tsx`

Line 12:
```diff
- <Flame className="h-8 w-8 text-amber-400" />
+ <Flame className="h-8 w-8 text-warning" />
```

#### `src/app/page.tsx`

Lines 106-113 (code block):
```diff
- <div className="mt-4 rounded-md border border-border bg-black p-4 font-mono text-xs leading-6 text-cyan-100">
-   <p><span className="text-amber-300">const</span> session = defend(rebuild);</p>
-   <p><span className="text-emerald-300">score</span>.update(session.reasoning);</p>
+ <div className="mt-4 rounded-md border border-border bg-card p-4 font-mono text-xs leading-6 text-foreground">
+   <p><span className="text-warning">const</span> session = defend(rebuild);</p>
+   <p><span className="text-success">score</span>.update(session.reasoning);</p>
```

#### `src/components/app/error-fallback.tsx`

Line 8:
```diff
- <div className="flex min-h-[400px] items-center justify-center p-4">
+ <div className="flex min-h-64 items-center justify-center p-4">
```

#### `src/components/app/app-shell.tsx`

Line 95:
```diff
- "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] text-muted-foreground",
+ "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground",
```

Backdrop opacities (lines 31, 62, 86):
```diff
- <aside className="... bg-card/80 backdrop-blur ...">
+ <aside className="... bg-card/90 backdrop-blur ...">

- <header className="... bg-background/85 px-4 backdrop-blur ...">
+ <header className="... bg-background/90 px-4 backdrop-blur ...">

- <nav className="... bg-card/95 px-2 py-2 backdrop-blur ...">
+ <nav className="... bg-card/90 px-2 py-2 backdrop-blur ...">
```

#### `src/components/features/irs-radar-chart.tsx`

Line 16:
```diff
- <p className="mt-1 text-xs text-muted-foreground/60">
+ <p className="mt-1 text-xs text-muted-foreground">
```

### Verification

```bash
# 1. No hardcoded emerald/amber/red/cyan colors in feature components
for f in quiz-ui.tsx diff-viewer.tsx streak-tracker.tsx irs-radar-chart.tsx; do
  ! grep -q "emerald\|text-amber\|text-red-\|text-cyan-\|bg-black" src/components/features/$f && echo "PASS: $f" || echo "FAIL: hardcoded colors in $f"
done

# 2. No text-[11px] 
! grep -r "text-\[11px\]" src/ --include="*.tsx" && echo "PASS: no text-[11px]" || echo "FAIL: text-[11px] remains"

# 3. No text-muted-foreground/60
! grep -r "text-muted-foreground/60" src/ --include="*.tsx" && echo "PASS: no /60 contrast issue" || echo "FAIL: /60 remains"

# 4. No min-h-[400px]
! grep -r "min-h-\[400px\]" src/ --include="*.tsx" && echo "PASS: no arbitrary 400px" || echo "FAIL: min-h-[400px] remains"

# 5. Backdrop opacities standardized (count occurrences)
SIDEBAR=$(grep -c "bg-card/90 backdrop-blur" src/components/app/app-shell.tsx)
HEADER=$(grep -c "bg-background/90" src/components/app/app-shell.tsx)
[ "$SIDEBAR" -ge 1 ] && [ "$HEADER" -ge 1 ] && echo "PASS: backdrop opacities standardized" || echo "FAIL: backdrop opacities not standardized"

# 6. Build compiles
npm run build -- --no-lint 2>&1 | tail -5
```

### Atomic commit message

```
fix(colors): migrate all hardcoded colors to theme tokens, fix typography

- quiz-ui: emerald→success tokens for correct/complete states
- diff-viewer: emerald→success, red→destructive tokens
- streak-tracker: text-amber-400→text-warning
- landing code block: bg-black→bg-card, cyan→foreground, amber→warning, emerald→success
- error-fallback: min-h-[400px]→min-h-64
- app-shell: text-[11px]→text-xs on mobile nav
- irs-radar-chart: remove /60 opacity on muted-foreground (WCAG contrast fix)
- Standardize backdrop opacities: 80/85/95→90 across sidebar, header, mobile nav
```

---

## Phase 6: Sign-out Confirmation Dialog + Data Wiring

**Goal:** Add sign-out confirmation dialog to prevent accidental one-click destructive action. Wire real API data to IRSRadarChart and Leaderboard components (currently receiving `data={[]}` and hardcoded defaults).

**Entry criteria:** All previous phases complete. App shell has import access to shadcn AlertDialog components (or they need to be created).

**Exit criteria:** Sign-out button shows confirmation dialog with "Cancel" + "Sign out" actions. IRSRadarChart and Leaderboard display real data from trpc queries instead of empty/default arrays.

**Files modified (5 files):**

| File | Change |
|------|--------|
| `src/components/app/app-shell.tsx` | Add AlertDialog for sign-out confirmation |
| `src/components/features/irs-radar-chart.tsx` | Ensure real data rendering (data already flows through, just ensure non-empty data renders correctly) |
| `src/components/features/leaderboard.tsx` | Same — ensure real data handling |
| `src/app/app/dashboard/page.tsx` | Fix leaderboard mapping to use existing data properties (removes hardcoded `streak: 0` and `track: ""`) |
| `src/app/app/war-room/page.tsx` | Same leaderboard mapping fix |
| `src/app/app/profile/page.tsx` | Pass real IRS data to radar chart instead of `data={[]}` |

### Detailed changes

#### `src/components/app/app-shell.tsx` — Sign-out confirmation

Add AlertDialog components (need to create if not existing):

1. Create `src/components/ui/alert-dialog.tsx` — standard shadcn AlertDialog (uses Radix):
```tsx
// Based on shadcn/ui AlertDialog pattern:
"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// ... AlertDialog, AlertDialogTrigger, AlertDialogContent,
//     AlertDialogHeader, AlertDialogFooter,
//     AlertDialogTitle, AlertDialogDescription,
//     AlertDialogAction, AlertDialogCancel
```

2. Update `app-shell.tsx`:
```diff
+ import {
+   AlertDialog,
+   AlertDialogTrigger,
+   AlertDialogContent,
+   AlertDialogHeader,
+   AlertDialogTitle,
+   AlertDialogDescription,
+   AlertDialogFooter,
+   AlertDialogCancel,
+   AlertDialogAction,
+ } from "@/components/ui/alert-dialog";

// Wrap the Sign out button:
- <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
+ <AlertDialog>
+   <AlertDialogTrigger asChild>
+     <Button variant="outline" size="sm">Sign out</Button>
+   </AlertDialogTrigger>
+   <AlertDialogContent>
+     <AlertDialogHeader>
+       <AlertDialogTitle>Sign out</AlertDialogTitle>
+       <AlertDialogDescription>
+         Are you sure you want to sign out? You'll need to sign in again to continue training.
+       </AlertDialogDescription>
+     </AlertDialogHeader>
+     <AlertDialogFooter>
+       <AlertDialogCancel>Cancel</AlertDialogCancel>
+       <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
+     </AlertDialogFooter>
+   </AlertDialogContent>
+ </AlertDialog>
```

Note: Need to add `@radix-ui/react-alert-dialog` to package.json if not present:
```json
"@radix-ui/react-alert-dialog": "^1.0.5",
```

#### `src/app/app/dashboard/page.tsx` — Fix leaderboard mapping

Lines 55-61:
```diff
  const leaderboardEntries = (leaderboard ?? []).map((entry) => ({
    id: entry.userId,
    name: entry.name,
    score: entry.score,
-   streak: 0,
-   track: "",
+   streak: entry.streak ?? 0,
+   track: entry.track ?? "",
  }));
```

#### `src/app/app/war-room/page.tsx` — Fix leaderboard mapping

Lines 40-46 (same pattern):
```diff
  const leaderboardEntries = (leaderboard ?? []).map((entry) => ({
    id: entry.userId,
    name: entry.name,
    score: entry.score,
-   streak: 0,
-   track: "",
+   streak: entry.streak ?? 0,
+   track: entry.track ?? "",
  }));
```

#### `src/app/app/dashboard/page.tsx` — Wire real IRS radar data

Line 145:
```diff
- <IRSRadarChart data={[]} />
+ <IRSRadarChart data={stats?.radarData ?? []} />
```

This assumes `stats.radarData` exists (not in current types — verify with actual API shape). If the API returns IRS data via a different key, adjust accordingly. The audit's concern is that `data={[]}` is always empty.

#### `src/app/app/profile/page.tsx` — Wire real IRS radar data

Line 53:
```diff
- <IRSRadarChart data={[]} />
+ <IRSRadarChart data={profile?.radarData ?? []} />
```

Same assumption — adjust based on actual API shape.

#### `src/components/features/irs-radar-chart.tsx`

No changes needed to the component itself — it already handles both empty (data.length === 0) and populated states correctly. The fix is at the call sites passing real data.

#### `src/components/features/leaderboard.tsx`

No changes needed — it already renders entry.name, entry.track, entry.score, entry.streak correctly. The fix is at the call sites passing properly mapped data (done above).

### Verification

```bash
# 1. AlertDialog component exists
test -f src/components/ui/alert-dialog.tsx && echo "PASS: AlertDialog exists" || echo "FAIL: AlertDialog missing"

# 2. App shell imports AlertDialog
grep -q "AlertDialog" src/components/app/app-shell.tsx && echo "PASS: AlertDialog imported in app-shell" || echo "FAIL: AlertDialog not imported"

# 3. Sign out button is wrapped in AlertDialog
grep -q "AlertDialogTrigger" src/components/app/app-shell.tsx && echo "PASS: Sign out has trigger" || echo "FAIL: No AlertDialogTrigger"

# 4. Leaderboard mapping has streak/track from data (not hardcoded)
grep -q "entry.streak" src/app/app/dashboard/page.tsx && echo "PASS: dashboard uses real streak" || echo "FAIL: dashboard still hardcodes streak"
grep -q "entry.streak" src/app/app/war-room/page.tsx && echo "PASS: war room uses real streak" || echo "FAIL: war room still hardcodes streak"

# 5. IRSRadarChart no longer receives empty data
! grep -q "data={\[\]" src/app/app/dashboard/page.tsx && echo "PASS: no empty radar on dashboard" || echo "FAIL: empty radar on dashboard"
! grep -q "data={\[\]" src/app/app/profile/page.tsx && echo "PASS: no empty radar on profile" || echo "FAIL: empty radar on profile"

# 6. Build compiles
npm run build -- --no-lint 2>&1 | tail -10
```

### Atomic commit message

```
feat(ux): add sign-out confirmation dialog, wire real data to radar+leaderboard

- Create AlertDialog component (shadcn/ui pattern with @radix-ui/react-alert-dialog)
- Wrap sign-out button in app-shell with confirmation dialog
- Fix leaderboard entry mapping to preserve streak/track from API data
- Pass real radar data from stats/profile queries to IRSRadarChart
- Remove hardcoded streak: 0 and track: "" defaults in dashboard and war-room
```

---

## Post-Phase Verification Checklist

After all 6 phases are complete, run these global checks:

```bash
# BUILD — must compile cleanly
cd apps/web && npm run build 2>&1 | tail -5

# LINT — zero warnings/errors
npm run lint 2>&1 | tail -10

# AI SLOP VIOLATIONS — confirm zero
echo "=== Checking banned patterns ==="
! grep -r "eyebrow=" src/ --include="*.tsx" && echo "✓ No eyebrow"
! grep -r "tracking-\[0.18em\]\|tracking-\[0.22em\]" src/ --include="*.tsx" && echo "✓ No custom tracking"
! grep -r "surface-grid" src/ --include="*.tsx" src/app/globals.css && echo "✓ No surface-grid"
! grep -r "text-\[11px\]" src/ --include="*.tsx" && echo "✓ No 11px"
! grep -r "text-muted-foreground/60" src/ --include="*.tsx" && echo "✓ No /60 contrast issue"
! grep -r "min-h-\[400px\]" src/ --include="*.tsx" && echo "✓ No arbitrary 400px"

# HARDCODED COLORS — flag any remaining bypasses
echo "=== Remaining hardcoded color bypasses ==="
grep -rn "text-emerald\|text-amber-3\|text-red-4\|text-cyan\|bg-emerald\|bg-red-\|bg-black" src/ --include="*.tsx" \
  | grep -v "node_modules" | grep -v "\.next" || echo "✓ No hardcoded colors found"

# COPY QUALITY
echo "=== Copy quality ==="
! grep -r "mock\|Socket.io\|socket.io" src/app/ --include="*.tsx" && echo "✓ No developer copy"
```

---

## File Change Summary

| Phase | Files Changed | Type |
|-------|---------------|------|
| 1 — Token Foundation | 2 | Design system |
| 2 — Component Fixes | 2 | Component library |
| 3 — Eyebrow Removal | 12 | 6 pages + 4 components + landing page |
| 4 — Copy + Surface Grid | 5 | 3 pages + 2 auth pages |
| 5 — Hardcoded Colors + Typography | 6 | 4 features + app-shell + error-fallback |
| 6 — Sign-out + Data Wiring | 6 | app-shell + radar + leaderboard + dashboard + profile + new component |
| **Total** | **~33 unique files** | |

## Rollback Strategy

Each phase is an atomic commit. To roll back any phase:
```bash
git revert <commit-hash> --no-edit
```

Phases are ordered so that reverting Phase 3 (eyebrow removal) also reverts the PageHeader API change, which is safe because no subsequent phase depends on the Phase 3 API shape.

## Risk Register

| Risk | Phase | Mitigation |
|------|-------|------------|
| TypeScript build fails due to PageHeader API changes | 3 | Fix all 12 call sites in same commit; build before committing |
| Radix alert-dialog peer dependency missing | 6 | `npm install @radix-ui/react-alert-dialog` as first step of Phase 6 |
| IRS radar data shape differs from expected | 6 | Check actual trpc return type before wiring; fall back to `data={[]}` with comment |
| Backdrop opacity change feels perceptible | 5 | 90% is visually close to 85% and 95%; design review checkpoint |
