---
phase: auth-review
fixed_at: 2026-07-03T12:00:00Z
review_path: REVIEW-auth.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Auth Review — Code Fix Report

**Fixed at:** 2026-07-03
**Source review:** REVIEW-auth.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-02: Add global tRPC error link + disable retries for 401

**Files modified:** `apps/web/src/lib/trpc/provider.tsx`
**Commit:** `7bdceb6`
**Applied fix:**
- Added a custom tRPC link that intercepts `TRPCClientError` with `code === "UNAUTHORIZED"` and redirects to `/auth/signin` via `router.push()` inside a `queueMicrotask` to avoid render-time side effects.
- Configured `QueryClient` `retry` callback to return `false` for `UNAUTHORIZED` errors (prevents React Query's default 3 retries on 401).

### CR-01: Check `unvibe_session_token` cookie in middleware for email/password users

**Files modified:** `apps/web/src/middleware.ts`
**Commit:** `13c0261`
**Applied fix:**
- Added early return `if (req.cookies.has("unvibe_session_token")) return;` to allow email/password-authenticated users through the middleware without a NextAuth JWT session.
- Preserved existing NextAuth `req.auth` check for OAuth users.
- Kept redirect to sign-in only when NO session evidence exists at all (defense-in-depth).

### CR-03: Redirect to sign-in on 401 instead of showing error state on dashboard

**Files modified:** `apps/web/src/app/app/dashboard/page.tsx`
**Commit:** `fceef57`
**Applied fix:**
- Added `useRouter` and `useEffect` imports for redirect.
- Replaced desctructured query variables with full query objects (`profileQuery`, `tracksQuery`, `leaderboardQuery`, `statsQuery`) to access the `.error` property.
- Added `hasUnauthorized` check across all 4 queries — if any returns `UNAUTHORIZED`, triggers `router.push("/auth/signin")` via `useEffect` and renders `null`.
- Non-auth errors still show the existing "Failed to load content" error state.

### WR-01: Call `checkSession()` during initialization to validate cached session

**Files modified:** `apps/web/src/app/providers.tsx`
**Commit:** `9e6ef9c`
**Applied fix:**
- Added `checkSession` and `user` selectors to `SessionRestorer`.
- Added a second `useEffect` that calls `checkSession()` when `user` becomes available (after `restoreSession` completes).
- This validates the localStorage-cached session against the server on initialization, preventing stale session data from showing incorrect auth state.

---

_Fixed: 2026-07-03_
_Fixer: OpenCode (gsd-code-fixer)_
_Iteration: 1_
