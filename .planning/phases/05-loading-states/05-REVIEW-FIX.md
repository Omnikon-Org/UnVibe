---
phase: 05
fixed_at: 2026-07-02T00:00:00Z
review_path: N/A (fixes applied from user instructions)
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 5: Loading States Review Fix Report

**Fixed at:** 2026-07-02T00:00:00Z
**Source review:** User-provided fix instructions
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 4
- Skipped: 1

## Fixed Issues

### Fix 1a: Dashboard page — wait for all queries before rendering

**Files modified:** `apps/web/src/app/app/dashboard/page.tsx`
**Commit:** `ad21034`
**Applied fix:** Changed from only checking `profileLoading` to aggregating loading/error states for all 4 queries (`profile`, `tracks`, `leaderboard`, `stats`). Added proper `isError` checks, combined `isLoading` state, and `!data` null guard after loading completes.

### Fix 1b: Module page — separate loading, error, and null-data checks

**Files modified:** `apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/page.tsx`
**Commit:** `ad21034`
**Applied fix:** Changed `if (isLoading || !dbModule)` to destructure `isError`/`error` from both queries and use three distinct guard clauses: error first, loading second, no-data third.

### Fix 1c: Profile page — add error handling for all 3 queries

**Files modified:** `apps/web/src/app/app/profile/page.tsx`
**Commit:** `ad21034`
**Applied fix:** Added `isError`/`error` destructuring for `profile`, `recentData`, and `stats` queries. Combined loading states across all three queries. Added error guard and null-data check for profile.

### Fix 1d: War-room page — add error handling for both queries

**Files modified:** `apps/web/src/app/app/war-room/page.tsx`
**Commit:** `ad21034`
**Applied fix:** Added `isError`/`error` destructuring for `room` and `leaderboard` queries. Combined loading states. Added error guard and null-data check.

### Fix 2: Create skeleton component and loading.tsx files

**Files modified:**
- `apps/web/src/components/app/skeleton.tsx` (new)
- `apps/web/src/app/app/dashboard/loading.tsx` (new)
- `apps/web/src/app/app/tracks/[trackId]/loading.tsx` (new)
- `apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/loading.tsx` (new)
- `apps/web/src/app/app/profile/loading.tsx` (new)
- `apps/web/src/app/app/war-room/loading.tsx` (new)
**Commit:** `ad21034`
**Applied fix:** Created reusable skeleton primitives (`Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonStatCard`, `SkeletonList`) and matching `loading.tsx` files for each route directory that mirror page layout structures.

## Skipped Issues

### Fix 1e: Tracks detail page — file does not exist

**File:** `apps/web/src/app/app/tracks/[trackId]/page.tsx`
**Reason:** The file `[trackId]/page.tsx` does not exist in the codebase. The `[trackId]` directory only contains a `modules/` subdirectory with `[moduleId]/page.tsx`. No page file exists at the track detail level to fix.
**Original issue:** Fix `isLoading || !data` anti-pattern on the track page.

---

_Fixed: 2026-07-02_
_Fixer: OpenCode (gsd-code-fixer)_
_Iteration: 1_
