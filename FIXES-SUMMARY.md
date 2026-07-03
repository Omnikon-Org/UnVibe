# UnVibe Project Fix Summary

**Completed:** 2026-07-02
**Duration:** ~2 hours
**Commits:** 5 fix commits + 1 existing

## Overview

Systematic review and fix pass across the UnVibe monorepo. Addressed build failures, security vulnerabilities (WR-07), Docker build issues, ESLint errors, test infrastructure gaps, and configuration hygiene. Both `api` and `web` packages now build cleanly. The API test suite (11 tests) runs and passes.

---

## Changes by Category

### 1. Security — WR-07: localStorage Session Token → httpOnly Cookies

**Commit:** `6b270e6`
**Files:** 7 files changed (+173/-78)

The highest-severity remaining finding from the code review. Session tokens were stored in `localStorage` (XSS vector). Fix uses Next.js rewrites to proxy `/trpc` and `/socket.io` to the API server, making requests same-origin, which enables httpOnly cookies.

**Changes:**
- **`apps/web/next.config.mjs`**: Added `async rewrites()` that proxy `/trpc/:path*` and `/socket.io/:path*` to `http://localhost:3001`
- **`apps/api/src/context.ts`**: Added `setSessionCookie()` and `clearSessionCookie()` helpers that set `httpOnly`, `SameSite=Strict`, `Secure` (prod) cookies. Added `unvibe_session_token` cookie to token extraction precedence. `createContext` now passes `res` (Express Response) through to tRPC procedures.
- **`apps/api/src/routers/auth.ts`**: `signIn`, `signUp`, and `linkOAuth` now call `setSessionCookie()` after creating DB sessions. `signOut` calls `clearSessionCookie()`.
- **`apps/web/src/stores/auth-store.ts`**: Complete rewrite — removed all `sessionToken` from localStorage. API calls use relative `/trpc` path (through proxy) with `credentials: "include"`. Only user profile metadata (id, name, email, image) is cached in localStorage as `unvibe_user_cache`. No sensitive tokens in JS-accessible storage.
- **`apps/web/src/lib/trpc/provider.tsx`**: Uses relative `/trpc` URL. Removed `Authorization: Bearer` header construction from localStorage. Fetch calls use `credentials: "include"`.
- **`apps/web/src/components/app/session-sync.tsx`**: Removed all sessionToken storage. Only caches user profile data. Removed `unvibe_auth_method` tracking.
- **`apps/web/src/lib/socket/client.ts`**: Added `withCredentials: true` so httpOnly cookie is sent with WebSocket upgrade requests.

**Fallback preserved:** When `NEXT_PUBLIC_API_URL` is set (direct API access, no proxy), the `extractSessionToken` function still checks `Authorization: Bearer` header as a fallback after the cookie check.

### 2. Build Fixes

**Commit:** `37357ee` (API), `484a1fd` (Web)

**API — undefined `lastSubmission` reference:**
- `apps/api/src/routers/profile.ts:141` referenced `lastSubmission?.createdAt` but `lastSubmission` was never defined in the `getStats` function scope
- **Fix:** Added `lastActiveDate` variable derived from sorted submission dates; fixed the return value to use it

**Web — ESLint build errors (5 errors):**
- `apps/web/src/app/api/auth/issue-link-token/route.ts:10` — `require("node:crypto")` replaced with ESM `import { createHmac } from "node:crypto"`
- 4 page components had `const firstError = ...` that was destructured but never used. Removed the unused `error:` destructuring from all tRPC hooks across `dashboard`, `profile`, `module`, and `war-room` pages.

**Result:** Both `pnpm --filter api build` and `pnpm --filter web build` succeed cleanly.

### 3. Docker Build Fixes

**Commit:** `dfdd1e3`

**`apps/api/Dockerfile`** (rewritten):
- **Workspace dependency fix:** Added `COPY packages/types/...` lines before `pnpm install` so workspace resolution succeeds
- **@unvibe/types build:** Added build step for `@unvibe/types` before building the API
- **Runtime deps fix:** Runner stage now copies from both `/app/node_modules` (root hoisted) and `/app/apps/api/node_modules` (local) so all runtime dependencies are available

**`.dockerignore`** (rewritten):
- Added: `.git`, `.turbo`, `.github`, `.editorconfig`, `.eslintrc*`, `.prettierrc`, `*.md`, `.DS_Store`, `Thumbs.db`, `.env`, `.env.local`, `__pycache__`, `*.pyc`, `.pytest_cache`, `.venv`, `venv`, `docs`, `*.tsbuildinfo`

### 4. Test Infrastructure

**Commit:** `da86f1f`

The API package had a comprehensive test file (`src/__tests__/ai-client.test.ts` with 11 tests) but no test runner was configured.

- Added `jest`, `ts-jest`, and `@types/jest` dev dependencies to `apps/api`
- Created `apps/api/jest.config.ts` with `ts-jest` preset
- Added `test` script to `apps/api`, `apps/web`, and `packages/types` package.json files
- All 11 tests pass: AIClient (code generation, quiz, diff, defend, retry logic, health check)

### 5. Configuration Hygiene

**Commit:** `dfdd1e3`

- **`.gitignore`**: Added `.pytest_cache/`, `.egg-info/`, `.DS_Store`, `Thumbs.db`
- **`.dockerignore`**: Comprehensive expansion (see Docker section above)
- **`pnpm-lock.yaml`**: Updated with Jest dependencies

---

## Self-Check: PASSED

- [x] All 11 modified/created files verified on disk
- [x] All 5 fix commits verified in git history
- [x] API build: clean (0 errors)
- [x] Web build: clean (0 errors)
- [x] Types build: clean (0 errors)
- [x] API tests: 11/11 passing

## Verification

```bash
# API build
pnpm --filter api build    # ✓ Clean (0 errors)

# Web build
pnpm --filter web build    # ✓ Clean (0 errors, all pages generated)

# TypeScript types build
pnpm --filter @unvibe/types build    # ✓ Clean

# API tests
pnpm --filter api test     # ✓ 11/11 passing
```

---

## Remaining Items (Out of Scope)

| Item | Description | Why Deferred |
|------|-------------|--------------|
| Web test suite | No web tests exist; `test` script is a no-op | Frontend testing strategy needed (Playwright/Vitest) |
| WebSocket proxy | Next.js rewrites may not proxy WebSocket upgrades | Depends on deployment platform; dev mode works via direct connection |
| IRS score scale | IN-02: potential 0-1 vs 0-100 inconsistency | Requires validating the AI service output scale |
| Submission transaction safety (WR-03) | Best-effort enqueue; zombies possible | Would require DB outbox pattern — architectural change |
| Magic number constants (IN-06) | Several inline numeric values | Low impact; code works correctly |
| `.env.local` exists in repo root | Contains actual credentials | Already in `.gitignore`; no risk of commit |
