---
phase: ui-audit
fixed_at: 2026-07-03T00:00:00Z
review_path: C:\Users\yuvra\OneDrive\Desktop\Yuvraj\UnVibe\UI-AUDIT.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# UI Audit — Code Fix Report

**Fixed at:** 2026-07-03
**Source review:** UI-AUDIT.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10
- Fixed: 10
- Skipped: 0

## Fixed Issues

### Fix 1: Remove eyebrow badge pattern from PageHeader

**Files modified:** 
- `apps/web/src/components/app/page-header.tsx`
- `apps/web/src/app/app/dashboard/page.tsx`
- `apps/web/src/app/app/tracks/page.tsx`
- `apps/web/src/app/app/war-room/page.tsx`
- `apps/web/src/app/app/blindspot-map/page.tsx`
- `apps/web/src/app/app/profile/page.tsx`

**Applied fix:** 
- Removed the `eyebrow` prop from PageHeader component interface
- Removed the Badge import from page-header.tsx
- Removed the conditional eyebrow badge render block
- Added `className` prop with `cn()` utility for extensibility
- Removed `eyebrow="..."` prop from all 6 PageHeader call sites in dashboard, tracks (x2), war-room, blindspot-map (x2), and profile pages

### Fix 2: Replace developer-facing copy

**Files modified:**
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/app/dashboard/page.tsx`
- `apps/web/src/app/app/war-room/page.tsx`

**Applied fix:**
- `"Open mock dashboard"` → `"Open dashboard"` (landing page CTA)
- `"Mock data mirrors the future API shape while the backend catches up."` → `"Track your training progress, streaks, and leaderboard ranking."` (dashboard description)
- `"Socket.io client wiring is present with a mock live feed so the room works without backend events."` → `"Compete in live coding sessions and defend your reasoning against peers."` (war room description)

### Fix 3: Fix Badge component hardcoded colors

**Files modified:**
- `apps/web/src/components/ui/badge.tsx`

**Applied fix:**
- `success` variant: `border-emerald-500/30 bg-emerald-500/10 text-emerald-400` → `border-success/30 bg-success/10 text-success`
- `warning` variant: `border-amber-500/30 bg-amber-500/10 text-amber-300` → `border-warning/30 bg-warning/10 text-warning`
- `destructive` variant: `border-red-500/30 bg-red-500/10 text-red-400` → `border-destructive/30 bg-destructive/10 text-destructive-foreground`

### Fix 4: Replace hardcoded colors in feature components

**Files modified:**
- `apps/web/src/components/features/quiz-ui.tsx`
- `apps/web/src/components/features/diff-viewer.tsx`
- `apps/web/src/components/features/streak-tracker.tsx`

**Applied fix:**
- QuizUI complete state: `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` → `border-success/30 bg-success/10 text-success`
- QuizUI correct answer: `border-emerald-500/40 bg-emerald-500/10 text-emerald-300` → `border-success/40 bg-success/10 text-success`
- DiffViewer additions: `bg-emerald-500/10` → `bg-success/10`
- DiffViewer removals: `bg-red-500/10` → `bg-destructive/10`
- StreakTracker flame: `text-amber-400` → `text-accent`

### Fix 5: Fix landing page hardcoded colors

**Files modified:**
- `apps/web/src/app/page.tsx`

**Applied fix:**
- Code block `bg-black` → `bg-card`
- Code block `text-cyan-100` → `text-foreground`
- Syntax highlight `text-amber-300` → `text-warning`
- Syntax highlight `text-emerald-300` → `text-success`
- Landing hero badge: removed `border-primary/40 bg-primary/10` (kept `variant="outline"`)
- Sample module label: removed `uppercase tracking-[0.22em]` and capitalized "Sample module"
- Removed hero metric numbering (the `0{index + 1}` span from signal items)
- Removed `surface-grid` class from hero section

### Fix 6: Fix mobile nav text size and error fallback

**Files modified:**
- `apps/web/src/components/app/app-shell.tsx`
- `apps/web/src/components/app/error-fallback.tsx`

**Applied fix:**
- `text-[11px]` → `text-xs` on mobile bottom nav labels
- Removed `uppercase tracking-[0.22em]` from user.email display
- Standardized backdrop opacities: sidebar `bg-card/80` → `bg-card/90`, header `bg-background/85` → `bg-background/90`, mobile nav `bg-card/95` → `bg-card/90`
- `min-h-[400px]` → `min-h-64` in ErrorFallback

### Fix 7: Fix IRS radar chart contrast

**Files modified:**
- `apps/web/src/components/features/irs-radar-chart.tsx`

**Applied fix:**
- `text-muted-foreground/60` → `text-muted-foreground` (fixes WCAG contrast failure)

### Fix 8: Replace uppercase tracking labels

**Files modified:**
- `apps/web/src/app/app/blindspot-map/page.tsx`
- `apps/web/src/components/features/code-editor.tsx`
- `apps/web/src/components/features/diff-viewer.tsx`

**Applied fix:**
- Blindspot map "Evidence" and "Next action" labels: `uppercase tracking-[0.18em]` → `text-xs font-medium text-muted-foreground`
- Code editor language label: removed `uppercase tracking-[0.18em]`
- Diff viewer column headers: `uppercase tracking-[0.18em]` → `font-medium`

### Fix 9: Add warning/success tokens to tailwind config

**Files modified:**
- `apps/web/tailwind.config.ts`

**Applied fix:**
- Added `success` color token (DEFAULT + foreground) referencing `--success` / `--success-foreground` CSS variables
- Added `warning` color token (DEFAULT + foreground) referencing `--warning` / `--warning-foreground` CSS variables

### Fix 10: Add semantic tokens to globals.css

**Files modified:**
- `apps/web/src/app/globals.css`

**Applied fix:**
- Removed `surface-grid` utility class from `@layer utilities`
- Added `--success`, `--success-foreground`, `--warning`, `--warning-foreground` CSS variables in `:root` (light mode)
- Added same variables in `.dark` (dark mode with adjusted lightness values)

## Verification Results

| Check | Pattern | Status |
|-------|---------|--------|
| ✅ | `surface-grid` in TSX/CSS | Zero occurrences |
| ✅ | `eyebrow=` props in TSX | Zero occurrences |
| ✅ | `text-emerald`, `text-amber-3`, `text-cyan`, `text-red-4` | Zero occurrences |
| ✅ | `bg-emerald`, `bg-red-` hardcoded | Zero occurrences |
| ✅ | `text-[11px]` | Zero occurrences |
| ✅ | `text-muted-foreground/60` | Zero occurrences |
| ✅ | `min-h-[400px]` | Zero occurrences |
| ✅ | `bg-black` | Zero occurrences |
| ✅ | `text-amber-` hardcoded | Zero occurrences |
| ✅ | `uppercase tracking-[` | Zero occurrences |

---

_Fixed: 2026-07-03_
_Fixer: OpenCode (gsd-code-fixer)_
_Iteration: 1_
