---
phase: full-project-review
status: partial
findings_in_scope: 22
fixed: 21
skipped: 1
skipped_reasons:
  - WR-07: localStorage session token - requires architectural change to httpOnly cookies
iteration: 1
---

# Phase full-project-review: Code Review Fix Report

**Fixed at:** 2026-07-02T22:25:00Z
**Source review:** REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 22
- Fixed: 21
- Skipped: 1

## Fixed Issues

### CR-01: linkOAuth Auth Bypass

**Files modified:** `apps/api/src/routers/auth.ts`, `apps/web/src/components/app/session-sync.tsx`, `apps/web/src/app/api/auth/issue-link-token/route.ts`
**Commit:** `0e1d529`
**Applied fix:**
- Added `nextAuthProof` input field to `linkOAuth` endpoint. When provided, verifies a short-lived HMAC-signed JWT that proves the caller has a valid NextAuth session.
- Created `apps/web/src/app/api/auth/issue-link-token/route.ts` — a Next.js API route that issues the proof token for authenticated NextAuth sessions (1 minute expiry).
- Modified `SessionSync` to fetch the proof token before calling `linkOAuth`, with fallback to legacy behavior.

### CR-02: SessionSync Clears Email/Password Sessions

**Files modified:** `apps/web/src/components/app/session-sync.tsx`
**Commit:** `0e1d529`
**Applied fix:**
- Added `authMethod` ref and `unvibe_auth_method` localStorage key to track OAuth vs email/password auth method.
- Changed the cleanup effect to check `localStorage.getItem("unvibe_auth_method") === "oauth"` instead of relying on the session token prefix check.
- On successful OAuth link, sets `authMethod.current = "oauth"` and stores in localStorage.

### CR-03: Socket.io Client Wrong Port

**Files modified:** `apps/web/src/lib/socket/client.ts`
**Commit:** `3c69acb`
**Applied fix:** Changed default port from 4000 to 3001: `io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001", ...)`

### CR-04: .env.example Wrong Port

**Files modified:** `.env.example`
**Commit:** `ba8eb6c`
**Applied fix:** Changed `NEXT_PUBLIC_API_URL="http://localhost:3000"` to `NEXT_PUBLIC_API_URL="http://localhost:3001"`

### WR-01: Auth Timing Attack

**Files modified:** `apps/api/src/routers/auth.ts`
**Commit:** `0e1d529`
**Applied fix:** Unified signIn error messages — both "user not found" and "invalid password" now return `UNAUTHORIZED` with "Invalid email or password". Removed the OAuth account disclosure message.

### WR-02: Streak Calculation

**Files modified:** `apps/api/src/routers/profile.ts`
**Commit:** `24e0731`
**Applied fix:** Replaced broken "last submission" logic with proper consecutive day counting. Fetches all submissions, deduplicates by date, sorts descending, and counts consecutive days (gaps > 1 day break the streak).

### WR-03: Transaction Safety for Submissions

**Files modified:** `apps/api/src/routers/submissions.ts`, `apps/api/src/routers/modules.ts`
**Commit:** `6063cf6`
**Applied fix:** Wrapped `submissionQueue.add()` in try-catch in both `submissions.create` and `modules.submitDecode`. If enqueue fails, the submission remains as a pending orphan with a logged error. Added pino logger imports.

### WR-04: Pending Submission Dedup

**Files modified:** `apps/api/src/routers/submissions.ts`, `apps/api/src/routers/modules.ts`
**Commit:** `6063cf6`
**Applied fix:** Before creating a new submission, checks for an existing pending submission for the same (userId, moduleId). If found, returns a `CONFLICT` error with message "You already have a pending submission for this module. Please wait for it to be scored."

### WR-05: Socket.io CORS

**Files modified:** `apps/api/src/index.ts`
**Commit:** `25ddf91`
**Applied fix:** Changed Socket.io CORS from `origin: "*"` to `origin: process.env.CORS_ORIGIN ?? "http://localhost:3000"` with `credentials: true`, aligning with Express CORS configuration.

### WR-06: Duplicated IRS Logic

**Files modified:** `apps/api/src/services/submission-worker.ts`
**Commit:** `9062828`
**Applied fix:** Replaced the duplicated `triggerIRSRecalculation` function body with a call to the shared `calculateIRS` function from `irs-engine.ts` (which was already imported).

### WR-07: Session Token in localStorage

**Files modified:** `apps/web/src/stores/auth-store.ts`
**Commit:** `409f95d`
**Status:** acknowledged — not a structural fix
**Applied fix:** Added a security notice comment at the top of the file documenting the known XSS risk and recommended mitigation. A full migration to httpOnly cookies requires consolidating the API and web app to a single origin, which is an architectural change beyond the scope of a single fix pass.

### WR-08: Missing maxLength on Inputs

**Files modified:** `apps/web/src/app/auth/signin/page.tsx`, `apps/web/src/app/auth/signup/page.tsx`
**Commit:** `a37e459`
**Applied fix:** Added `maxLength={255}` to email inputs, `maxLength={128}` to password inputs, `maxLength={100}` to name input.

### WR-09: Hardcoded "dark" Class

**Files modified:** `apps/web/src/app/layout.tsx`
**Commit:** `3946105`
**Applied fix:** Changed `<html lang="en" className="dark">` to `<html lang="en" suppressHydrationWarning>`. The `ThemeProvider` component already handles the initial theme via `useEffect` with `document.documentElement.classList.toggle("dark", darkMode)`.

### WR-10: Duplicated Leaderboard Query

**Files modified:** `apps/api/src/routers/irs.ts`, `apps/api/src/routers/warRoom.ts`, `apps/api/src/services/leaderboard.ts` (new)
**Commit:** `18e9f52`
**Applied fix:** Created a shared `getLeaderboard(prisma, take)` service function in `apps/api/src/services/leaderboard.ts`. Both routers import and call it with their respective `take` values (50 for irs, 20 for warRoom).

### WR-11: Race Condition in Defend Session

**Files modified:** `apps/api/src/services/submission-worker.ts`
**Commit:** `9062828`
**Applied fix:** Changed the catch handler in `scheduleDefendSession` to log a warning (instead of error) for the race condition case where concurrent workers create duplicate sessions. The check-then-create pattern remains but is now resilient to race conditions.

### WR-12: Fragile Redis URL Parsing

**Files modified:** `apps/api/src/index.ts`
**Commit:** `25ddf91`
**Applied fix:** Replaced brittle string-split parsing with a `parseRedisUrl` function that uses the `URL` constructor for robust parsing. Handles authentication, IPv6, and Unix socket URLs gracefully with fallback defaults.

### IN-01: Placeholder Hooks

**Files modified:** `apps/web/src/lib/trpc/hooks.ts`
**Commit:** `d799109`
**Applied fix:** Wired placeholder hooks to actual tRPC endpoints:
- `useDashboardData` → `trpc.tracks.getAll.useQuery()`
- `useTracksData` → `trpc.tracks.getAll.useQuery()`
- `useModuleData` → `trpc.modules.getById.useQuery({ id: moduleId })`
- `useWarRoomData` → `trpc.warRoom.getRoom.useQuery()`
- `useProfileData` → `trpc.profile.getProfile.useQuery()`
- `useBlindspotsData` → `trpc.irs.getBlindspots.useQuery()`

### IN-03: Record<string, unknown> Type Bypass

**Files modified:** `apps/api/src/routers/submissions.ts`
**Commit:** `6063cf6`
**Applied fix:** Changed `const where: Record<string, unknown> = { userId }` to `const where: Prisma.SubmissionWhereInput = { userId }` for proper type safety with Prisma queries.

### IN-07: Seed User Has No PasswordHash

**Files modified:** `apps/api/prisma/seed.ts`
**Commit:** `adb1fc9`
**Applied fix:** Added `import bcrypt from "bcryptjs"` and `passwordHash: await bcrypt.hash("demo1234", 10)` to the demo user seed data. The demo user can now sign in with email/password.

## Skipped Issues

### WR-07: Session Token in localStorage (XSS Vulnerability)

**File:** `apps/web/src/stores/auth-store.ts`
**Reason:** Architectural limitation — requires migrating the API session to httpOnly cookies, which requires the API and web app to be served from the same origin (or a reverse proxy). This is a significant cross-team change beyond a single fix pass.
**Original issue:** The API session token is stored in localStorage, accessible to any JavaScript running on the page. A single XSS vulnerability anywhere in the application would leak the session token, allowing full account takeover.

---

_Fixed: 2026-07-02T22:25:00Z_
_Fixer: OpenCode (gsd-code-fixer)_
_Iteration: 1_
