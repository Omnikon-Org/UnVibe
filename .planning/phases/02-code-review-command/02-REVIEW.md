---
phase: 02-code-review-command
reviewed: 2026-07-02T12:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/page.tsx
  - apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/error.tsx
  - apps/web/src/app/app/dashboard/page.tsx
  - apps/web/src/app/app/dashboard/error.tsx
  - apps/web/src/app/app/tracks/page.tsx
  - apps/web/src/app/app/tracks/error.tsx
  - apps/web/src/app/app/war-room/page.tsx
  - apps/web/src/app/app/war-room/error.tsx
  - apps/web/src/app/app/profile/page.tsx
  - apps/web/src/app/app/profile/error.tsx
  - apps/web/src/app/app/blindspot-map/page.tsx
  - apps/web/src/app/app/blindspot-map/error.tsx
  - apps/web/src/app/app/page.tsx
  - apps/web/src/app/app/layout.tsx
  - apps/web/src/components/app/loading-panel.tsx
  - apps/web/src/components/app/error-fallback.tsx
  - apps/web/src/components/features/module-player.tsx
  - apps/api/src/routers/modules.ts
  - apps/api/src/routers/tracks.ts
  - apps/api/src/routers/profile.ts
  - apps/api/src/routers/warRoom.ts
  - apps/api/src/routers/submissions.ts
  - apps/api/src/index.ts
  - apps/api/src/trpc.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/seed.ts
  - apps/web/src/lib/trpc/client.ts
  - apps/web/src/lib/trpc/provider.tsx
  - apps/web/src/lib/trpc/hooks.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 02: Code Review Report — Module Page & Loading States

**Reviewed:** 2026-07-02T12:00:00Z
**Depth:** deep
**Files Reviewed:** 17 (full cross-file trace: pages → routers → seed → trpc client → types)
**Status:** issues_found

## Summary

The module page and all sub-pages share the same structural bug: **tRPC query failures are indistinguishable from loading states**, causing infinite spinner loops. Every `{isLoading || !data}` guard across 5 pages has the same flaw — when a query errors or returns null, the UI shows "loading" forever instead of an error message. No `loading.tsx` files exist anywhere in the app, and the single generic `LoadingPanel` component provides no page-specific skeleton structure. The error boundaries (`error.tsx`) are declared but can never trigger for tRPC query failures because the components swallow errors instead of throwing.

---

## Critical Issues

### CR-01: Module page infinite loading when query fails (ROOT CAUSE)

**File:** `apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/page.tsx:14`
**Issue:** The guard `if (isLoading || !dbModule)` conflates the "still loading" state with "data not found / query error". When the `trpc.modules.getById.useQuery()` or `trpc.tracks.getById.useQuery()` query fails (network error, NOT_FOUND, UNAUTHORIZED, server error), the tRPC client sets `data = undefined`, `isLoading = false`, `isError = true`. The condition `!dbModule` evaluates to `true` because `data` is `undefined` — so the page renders `LoadingPanel` **indefinitely**. The consumer sees a spinner that never resolves.

**Trace through all failure scenarios:**

| Scenario | isLoading | data (dbModule) | isError | Guard result | User sees |
|---|---|---|---|---|---|
| Loading in progress | true | undefined | false | true | LoadingPanel (correct) |
| Query succeeds | false | Module object | false | false | Content (correct) |
| Query succeeds but module is null | false | undefined | true (NOT_FOUND thrown) | `!undefined` = true | **LoadingPanel forever** ✗ |
| Network error | false | undefined | true | `!undefined` = true | **LoadingPanel forever** ✗ |
| Auth error (UNAUTHORIZED) | false | undefined | true | `!undefined` = true | **LoadingPanel forever** ✗ |

The same `isLoading || !data` pattern appears in **4 other pages** (see CR-02).

**Note:** The `error.tsx` file at `modules/[moduleId]/error.tsx` exists but **cannot help here** because Next.js error boundaries only catch exceptions thrown during render. This component never throws — it returns a LoadingPanel instead. The error boundary is dead code for this failure mode.

**Fix:** Destructure `isError` and `error` from the query result and render distinct error states:

```tsx
export default function ModulePage({ params }: { params: { trackId: string; moduleId: string } }) {
  const {
    data: trackData,
    isLoading: trackLoading,
    isError: trackError,
    error: trackErr,
  } = trpc.tracks.getById.useQuery({ id: params.trackId });
  const {
    data: dbModule,
    isLoading: moduleLoading,
    isError: moduleError,
    error: moduleErr,
  } = trpc.modules.getById.useQuery({ id: params.moduleId });

  if (trackLoading || moduleLoading) return <LoadingPanel label="Loading module player" />;

  if (trackError || moduleError) {
    const message = trackErr?.message ?? moduleErr?.message ?? "Failed to load module";
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Failed to load module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dbModule || !trackData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Module not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This module doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ... rest of component
}
```

---

### CR-02: Same infinite-loading bug replicated across 4 additional pages

The `if (isLoading || !data) return <LoadingPanel />;` anti-pattern appears in these files, each with the same failure mode.

**1. Tracks page**

**File:** `apps/web/src/app/app/tracks/page.tsx:13`
```tsx
if (isLoading || !tracks) return <LoadingPanel />;
```

**2. War Room page**

**File:** `apps/web/src/app/app/war-room/page.tsx:13`
```tsx
if (isLoading || !room) return <LoadingPanel label="Joining War Room" />;
```

**3. Profile page**

**File:** `apps/web/src/app/app/profile/page.tsx:18`
```tsx
if (isLoading || !profile) return <LoadingPanel label="Loading profile" />;
```

**4. Module page** (covered in CR-01)
```tsx
if (isLoading || !dbModule) return <LoadingPanel label="Loading module player" />;
```

**Fix for all 4 pages:** Same pattern as CR-01 — check `isError` and `error` first, then check for null data, and only show LoadingPanel during active loading (`isLoading` alone, not `!data`).

---

### CR-03: Zero loading.tsx files in the entire app directory

**Files:** All page directories — no `loading.tsx` found anywhere.

Next.js App Router supports automatic loading states via `loading.tsx` files co-located with `page.tsx`. These provide immediate feedback during route transitions (page navigation). Without them:

- Navigation between pages shows nothing during the brief loading period
- The browser tab title may change but the page remains blank until the client component hydrates
- Users perceive the app as sluggish or unresponsive

**Missing loading.tsx locations:**

| Route | Page file | loading.tsx exists? |
|---|---|---|
| `/app/dashboard` | `dashboard/page.tsx` | ✗ |
| `/app/tracks` | `tracks/page.tsx` | ✗ |
| `/app/war-room` | `war-room/page.tsx` | ✗ |
| `/app/profile` | `profile/page.tsx` | ✗ |
| `/app/blindspot-map` | `blindspot-map/page.tsx` | ✗ |
| `/app/tracks/[trackId]/modules/[moduleId]` | `tracks/[trackId]/modules/[moduleId]/page.tsx` | ✗ |
| **Any layout-level** | `app/layout.tsx` | ✗ |

**Fix:** Create `loading.tsx` files for each route segment. For a simple approach, create one at `app/app/loading.tsx` that provides a full-page skeleton:

```tsx
// apps/web/src/app/app/loading.tsx
import { LoadingPanel } from "@/components/app/loading-panel";

export default function AppLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <LoadingPanel label="Loading..." />
    </div>
  );
}
```

For a better UX, create route-specific skeleton components (e.g., a card grid skeleton for `/tracks`, a module-player layout skeleton for `/modules/[moduleId]`).

---

## Warnings

### WR-01: Dashboard page renders before tracks/leaderboard/stats are ready

**File:** `apps/web/src/app/app/dashboard/page.tsx:16-21`
```tsx
const { data: profile, isLoading: profileLoading } = trpc.profile.getProfile.useQuery();
const { data: tracks } = trpc.tracks.getAll.useQuery();
const { data: leaderboard } = trpc.warRoom.getLeaderboard.useQuery();
const { data: stats } = trpc.profile.getStats.useQuery();

if (profileLoading) return <LoadingPanel />;
```

The guard only waits for `profileLoading`. If the profile resolves quickly but tracks/leaderboard/stats are still loading, the page renders with undefined data for those sections:
- `activeTrack` will be `null` until tracks arrive (mitigated by `tracks?.[0]` but the empty-state UI flashes briefly)
- `leaderboardEntries` will be `[]` until leaderboard arrives
- Stat cards show data but `stats?.currentStreak` is undefined

**Fix:** Either wait for all queries or add per-section loading states:

```tsx
const isPageReady = profileLoading || tracksLoading || statsLoading;
if (isPageReady) return <LoadingPanel />;
```

Or better, add section-level skeleton placeholders so parts of the page render as data arrives.

---

### WR-02: Module page doesn't destructure `isError` or `error` from any query

**File:** `apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/page.tsx:9-10`
```tsx
const { data: trackData, isLoading: trackLoading } = trpc.tracks.getById.useQuery({ id: params.trackId });
const { data: dbModule, isLoading: moduleLoading } = trpc.modules.getById.useQuery({ id: params.moduleId });
```

Neither the `trackData` nor `dbModule` query destructures `isError` or `error`. This makes it impossible for the component to detect query failures. The subsequent guard `if (isLoading || !dbModule)` is the only safety net, and it treats errors as "still loading."

This affects every page in the app — none of them destructure query error states. All rely on the flawed `!data` check.

**Affected pages:**
- `dashboard/page.tsx` — 4 queries, none check error
- `tracks/page.tsx` — 1 query, no error check
- `war-room/page.tsx` — 2 queries, no error check
- `profile/page.tsx` — 3 queries, no error check
- `blindspot-map/page.tsx` — 1 query, no error check
- `modules/[moduleId]/page.tsx` — 2 queries, no error check (CR-01)

**Fix:** Always destructure `isError` and `error` from tRPC queries in client components and render error states.

---

### WR-03: Dashboard renders with partial data — hardcoded "Focus" value

**File:** `apps/web/src/app/app/dashboard/page.tsx:30`
```tsx
{ label: "Focus", value: "34m", copy: "Next module estimate", icon: Clock },
```

The "Focus" stat card displays a hardcoded `"34m"` value instead of computing it from actual data. This is misleading to users and will rot as the app grows. The dashboard already queries `trpc.profile.getStats` which could provide estimated time if the schema were extended.

**Fix:** Either compute the estimate from real data, remove the card, or mark it clearly as a placeholder.

---

### WR-04: Profile page not waiting for all queries before rendering

**File:** `apps/web/src/app/app/profile/page.tsx:16-18`
```tsx
const isLoading = profileLoading;
if (isLoading || !profile) return <LoadingPanel label="Loading profile" />;
```

The `isLoading` computation only considers `profileLoading`, but the component also uses `recentData` and `stats` from separate queries. If those queries are still loading when `profile` arrives, the "Recent modules" and "StreakTracker" sections render with empty/zero data.

---

### WR-05: Blindspot map page never handles query errors

**File:** `apps/web/src/app/app/blindspot-map/page.tsx:11-13`
```tsx
const { data: blindspots, isLoading } = trpc.irs.getBlindspots.useQuery();
if (isLoading) return <LoadingPanel label="Mapping blindspots" />;
```

This page is slightly better — it only checks `isLoading`, not `!blindspots`. So if the query errors, `isLoading` is false and the page proceeds to render `items = blindspots ?? []` with an empty array. This avoids the infinite spinner but silently shows an empty state ("No blindspots identified yet") even when the real cause is a network error or server failure.

**Fix:** Add error state:
```tsx
if (isError) {
  return <div className="...">Failed to load blindspots: {error.message}</div>;
}
```

---

### WR-06: Hooks file has placeholder implementations that shadow real queries

**File:** `apps/web/src/lib/trpc/hooks.ts`

This file exports wrapper hooks like `useModuleData`, `useDashboardData`, `useTracksData`, etc. All of them call `trpc.health.useQuery()` — a meaningless health-check procedure — instead of the actual tRPC procedures. The comments say "Placeholder — returns empty until [router] is built", but the routers ARE built in `apps/api/src/index.ts` (tracks, modules, profile, warRoom, irs routers are all registered).

These hooks are not imported anywhere in the page files (the pages use `trpc.*` directly), so they aren't causing bugs currently. But they are **dead code that will silently produce wrong results if consumed**. A developer finding `useModuleData(trackId, moduleId)` and using it would get health-check data instead of module data.

**Fix:** Either delete this file entirely (the pages call tRPC directly) or update the hooks to call the correct procedures.

---

## Info

### IN-01: LoadingPanel component is too generic for skeleton purposes

**File:** `apps/web/src/components/app/loading-panel.tsx`

```tsx
export function LoadingPanel({ label = "Loading mock data" }: { label?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="h-2 w-40 animate-pulse rounded-full bg-primary/30" />
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
```

This component shows only a thin animated bar and a text label. It doesn't match any page layout, so the user can't visually anticipate the page structure during loading. Compare to skeleton screens that mirror the page's card grid, sidebar, or content layout.

**Suggestion:** Create page-specific skeleton components (e.g., `DashboardSkeleton`, `ModulePageSkeleton`, `TracksSkeleton`) that use `LoadingPanel` as a building block but arrange multiple skeleton cards in the correct grid layout. This is a UX improvement, not a bug fix.

---

### IN-02: Dead "modules" export in `tracks.getById` response includes `modules` array

**File:** `apps/api/src/routers/tracks.ts:19-28`

The `getById` procedure returns `track` including `modules` (with full module data). The module page does use `trackData` only for the eyebrow title (`trackData?.title`). The `modules` array is fetched but only `trackData.title` is consumed. This is wasteful for the module page query but may be intentional for reusability. Consider adding a `select` to only fetch what's needed, though this is a minor optimization.

---

### IN-03: Error boundary files are duplicated boilerplate

All `error.tsx` files have the same 4-line content:
```tsx
"use client";
import { ErrorFallback } from "@/components/app/error-fallback";
export { ErrorFallback as default };
```

6 identical files. This duplication could be eliminated by placing a single `error.tsx` at the layout level (`app/app/error.tsx`), which would cascade to all child routes. However, the current structure allows per-route customization later.

**Suggestion:** Consider consolidating to `app/app/error.tsx` to reduce boilerplate, unless per-route error handling is planned.

---

## Architecture Observations

### Data flow analysis

```
Seed data (custom IDs: "mod-react-state", etc.)
    → prisma upsert → PostgreSQL
    → tRPC publicProcedure query → JSON response
    → React Query cache → page component render
```

The seed data uses custom string IDs (not Prisma's default `cuid()`). These are correctly propagated via `upsert` with `where: { id }`. The dashboard and tracks pages generate links using the same IDs:

- Dashboard: `/app/tracks/${activeTrack.id}/modules/${module.id}`
- Tracks page: `/app/tracks/${track.id}/modules/${module.id}`

These produce URLs like `/app/tracks/track-frontend-systems/modules/mod-react-state`, which match the seed data. **No ID mismatch exists** — the infinite loading is not caused by wrong IDs but by the error-handling gap described in CR-01.

### Error boundary effectiveness analysis

| Page | error.tsx | Catches render errors? | Catches tRPC query failures? |
|---|---|---|---|
| dashboard | ✓ | ✓ (but no render error occurs) | ✗ (component returns LoadingPanel) |
| tracks | ✓ | ✓ | ✗ |
| war-room | ✓ | ✓ | ✗ |
| profile | ✓ | ✓ | ✗ |
| blindspot-map | ✓ | ✓ | ✗ |
| module page | ✓ | ✓ | ✗ |

The `error.tsx` files act as a **secondary safety net** — they catch unexpected render exceptions (null dereferences, undefined access). But they **cannot** catch tRPC query failures because the page components don't throw — they return LoadingPanel when data is missing. The primary fix must happen in the page components.

---

## Summary of Required Fixes

| Priority | File(s) | Issue | Fix |
|---|---|---|---|
| BLOCKER | `modules/[moduleId]/page.tsx:14` | Infinite loading on query error | Separate loading/error/empty states |
| BLOCKER | 4 other page files | Same infinite-loading anti-pattern | Same fix |
| BLOCKER | All page directories | Missing `loading.tsx` | Create route-level loading skeletons |
| WARNING | `dashboard/page.tsx:21` | Only waits for 1 of 4 queries | Check all loading states or add section skeletons |
| WARNING | All page components | Missing `isError`/`error` destructuring | Add error destructuring to all useQuery calls |
| WARNING | `dashboard/page.tsx:30` | Hardcoded "34m" value | Derive from real data or mark as placeholder |
| WARNING | `profile/page.tsx:16` | Only waits for profile query | Wait for all queries used in render |
| WARNING | `blindspot-map/page.tsx:13` | Silently shows empty on error | Add error state |
| WARNING | `lib/trpc/hooks.ts` | Dead placeholder hooks | Delete or fix |
| INFO | `loading-panel.tsx` | Generic loading UI | Build page-specific skeleton components |
| INFO | `error.tsx` files | 6 identical boilerplate files | Consolidate to layout level |

---

### Immediate fix priority

1. **CR-01 + CR-02**: Fix the loading guards across all 5 pages — this is the root cause of "module page keeps loading"
2. **CR-03**: Add at least one `loading.tsx` at `app/app/loading.tsx` for route transitions
3. **WR-06**: Delete or fix the dead hooks in `lib/trpc/hooks.ts`
4. **WR-01 + WR-04**: Fix the partial loading waits in dashboard and profile pages

---

_Reviewed: 2026-07-02T12:00:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: deep_
