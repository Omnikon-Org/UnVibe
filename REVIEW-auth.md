---
phase: auth-review
reviewed: 2026-07-03T12:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - apps/web/src/app/app/dashboard/page.tsx
  - apps/web/src/app/app/dashboard/loading.tsx
  - apps/web/src/app/app/dashboard/error.tsx
  - apps/web/src/app/app/profile/page.tsx
  - apps/web/src/app/app/profile/error.tsx
  - apps/web/src/components/app/error-fallback.tsx
  - apps/web/src/lib/trpc/provider.tsx
  - apps/web/src/lib/trpc/client.ts
  - apps/web/src/middleware.ts
  - apps/web/src/auth.ts
  - apps/web/src/stores/auth-store.ts
  - apps/web/src/components/app/session-sync.tsx
  - apps/web/src/app/providers.tsx
  - apps/web/src/app/app/layout.tsx
  - apps/web/src/components/app/app-shell.tsx
  - apps/web/src/app/auth/signin/page.tsx
  - apps/web/next.config.mjs
  - apps/api/src/context.ts
  - apps/api/src/trpc.ts
  - apps/api/src/routers/profile.ts
  - apps/api/src/routers/auth.ts
  - apps/api/src/index.ts
findings:
  critical: 4
  warning: 4
  info: 4
  total: 12
status: issues_found
---

# Auth & Error Handling Review

**Reviewed:** 2026-07-03T12:00:00Z
**Depth:** deep (cross-file analysis)
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The authentication and error handling architecture has a fundamental flaw: **two parallel auth systems** (NextAuth.js for OAuth, custom API sessions for email/password) with incomplete bridging. The middleware only checks NextAuth sessions, causing email/password-authenticated users to be redirected on page refresh. The tRPC client has no global 401 error link, so protected-procedure failures surface as "Failed to load content" instead of redirecting to sign-in. Additionally, the client-side auth-store caches user data in localStorage without ever validating session freshness against the server.

The reported 401 errors (`/trpc/profile.getProfile,profile.getStats?batch=1` → 401 × 3) are a symptom of these systemic issues: nothing short-circuits tRPC queries when no session exists, React Query retries the failed 401 requests 3 times by default, and the error handling code shows a static message instead of redirecting.

---

## Critical Issues

### CR-01: Middleware blocks email/password users on page refresh

**File:** `apps/web/src/middleware.ts:3-9`
**Issue:** The middleware uses NextAuth's `auth()` helper which only checks for a valid NextAuth JWT cookie (`authjs.session-token` or `__Secure-authjs.session-token`). Users who sign in via the custom email/password flow receive a `unvibe_session_token` cookie from the API, but never a NextAuth JWT. On client-side navigation (`router.push`) the middleware doesn't run, so it "works", but on full page refresh (`F5`, new tab, direct URL entry) the middleware checks `req.auth`, finds `null`, and redirects to sign-in.

This means **email/password authentication is broken for any navigation that triggers a server-side middleware check** — which is the majority of real-world usage (bookmarks, reloads, sharing links).

**Root cause:** Two parallel auth systems with no shared middleware validation. NextAuth middleware cannot validate custom API session tokens without a DB call (Edge Runtime limitation).

**Recommendation:** One of:
- **(Option A)** Have the middleware check for the presence of either cookie (`unvise_session_token` OR `authjs.session-token`) without DB validation. Accept that expired tokens produce a 401 from tRPC which will be caught by the error link (CR-02 fix).
- **(Option B)** Remove the middleware redirect and rely entirely on the tRPC error link (CR-02) for client-side protection, plus a root layout server component that checks the session cookie before rendering.
- **(Option C)** Add `unvibe_session_token` as a recognized cookie in NextAuth's configuration so `req.auth` picks it up.

**Fix (Option A — simplest, defense-in-depth):**

```typescript
// apps/web/src/middleware.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Allow through if NextAuth session exists (OAuth users)
  if (req.auth) return;
  
  // Allow through if custom API session cookie exists (email/password users)
  // Cookie validation happens server-side via tRPC protectedProcedure
  const hasApiSession = req.cookies.has("unvibe_session_token");
  if (hasApiSession) return;

  // Redirect to sign-in only if NO session evidence exists at all
  if (req.nextUrl.pathname.startsWith("/app")) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
```

---

### CR-02: No global tRPC error link for 401 → redirect to sign-in

**File:** `apps/web/src/lib/trpc/provider.tsx:18-29`
**Issue:** The tRPC client is created with only an `httpBatchLink`. There is no `TRPCClientErrorLink` or custom link that intercepts `UNAUTHORIZED` errors and redirects to `/auth/signin`. Every protected-procedure query that fails with 401 surfaces as a generic error in the component's `isError` state rather than redirecting the user.

When combined with React Query's default `retry: 3` behavior, a single 401 causes **4 HTTP requests** (1 initial + 3 retries) before the error state is shown. The browser console fills with red 401 errors.

**Recommendation:** Add a `tRPCLink` chain with a `401InterceptorLink` that catches `TRPCClientError` with code `UNAUTHORIZED`, calls the router's `push` method, and optionally signals React Query to stop retrying (by throwing a non-retryable error or using `retry: false` on auth-dependent queries).

**Fix:**

```typescript
// apps/web/src/lib/trpc/provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, splitLink, TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "./client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't retry 401 errors — redirect immediately
            retry: (failureCount, error) => {
              if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      }),
  );

  const trpcUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/trpc`
    : "/trpc";

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        // Custom 401 handling link
        (ctx) => {
          const { op, next, prev, onDestroy } = ctx;
          // Run the next link
          const result = next(op, prev, onDestroy);
          // Intercept the response
          result.then((res) => {
            if (res instanceof Error) {
              const error = res as TRPCClientError<any>;
              if (error.data?.code === "UNAUTHORIZED") {
                // Use next/navigation to redirect
                // (router.push must be called from a useEffect to avoid render-time side effects)
                queueMicrotask(() => {
                  router.push("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname));
                });
              }
            }
          });
          return result;
        },
        httpBatchLink({
          url: trpcUrl,
          fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

> **Note:** The above custom link is simplified. The production implementation should use `tRPC`'s `link` API properly (`@trpc/client` provides `observable` and factory helpers).

---

### CR-03: Dashboard & Profile pages show "Failed to load content" instead of redirecting on 401

**File:** `apps/web/src/app/app/dashboard/page.tsx:27-34`
**File:** `apps/web/src/app/app/profile/page.tsx:21-28`
**Issue:** When all tRPC queries fail with 401 (no session), the `isError` check renders a static error alert:

```tsx
if (isError) return (
  <div role="alert" className="rounded-md bg-destructive/10 p-6 text-center">
    <p className="font-medium text-destructive">Failed to load content</p>
    <p className="mt-2 text-sm text-muted-foreground">
      Please try refreshing the page. If the issue persists, contact support.
    </p>
  </div>
);
```

This is wrong for unauthenticated users — the issue isn't "content failed to load", it's "you need to sign in". The message "try refreshing the page" is actively harmful: a refresh would trigger middleware that might redirect, but for email/password users the middleware also doesn't work correctly (CR-01), so they'd see the same error again in an infinite loop.

Additionally, the `isError` variable uses `||` which means a single failed query masks all others. If `profile.getProfile` fails with 401, the entire page shows the error state even if `tracks.getAll` (a public procedure) would have succeeded.

**Recommendation:** Check for 401/unauthorized errors specifically and redirect to sign-in. For non-auth errors, keep the error display.

**Fix:**

```typescript
// In dashboard/page.tsx
import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Inside DashboardPage component:
const router = useRouter();
const profileQuery = trpc.profile.getProfile.useQuery();
const tracksQuery = trpc.tracks.getAll.useQuery();
const leaderboardQuery = trpc.warRoom.getLeaderboard.useQuery();
const statsQuery = trpc.profile.getStats.useQuery();

const queries = [profileQuery, tracksQuery, leaderboardQuery, statsQuery];
const isLoading = queries.some((q) => q.isLoading);
const has401 = queries.some(
  (q) => q.error && q.error.data?.code === "UNAUTHORIZED"
);

useEffect(() => {
  if (has401) {
    router.push("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname));
  }
}, [has401, router]);

if (has401) return null; // redirect is happening
if (queries.some((q) => q.isError)) {
  const nonAuthErrors = queries.filter((q) => q.error && q.error.data?.code !== "UNAUTHORIZED");
  if (nonAuthErrors.length > 0) {
    // Show error state for non-auth errors
    return (
      <div role="alert" className="rounded-md bg-destructive/10 p-6 text-center">
        <p className="font-medium text-destructive">Failed to load content</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try refreshing the page. If the issue persists, contact support.
        </p>
      </div>
    );
  }
}
```

---

### CR-04: `linkOAuth` is exposed as public procedure with optional proof verification — account takeover vector

**File:** `apps/api/src/routers/auth.ts:94-154`
**File:** `apps/web/src/components/app/session-sync.tsx:43-52`
**Issue:** `auth.linkOAuth` is a `publicProcedure` that creates DB sessions and sets httpOnly cookies. The `nextAuthProof` parameter is optional — if the proof endpoint (`/api/auth/issue-link-token`) is unavailable or the fetch fails, the `catch` block in `session-sync.ts` silently falls through and calls `linkMutation.mutate()` with no proof token:

```typescript
try {
  const proofRes = await fetch("/api/auth/issue-link-token", { method: "POST" });
  // ...
} catch {
  // Fall back to legacy behavior if proof endpoint unavailable
}
linkMutation.mutate({ id: user.id, name: ..., email: ..., image: ..., nextAuthProof: undefined }, ...);
```

When `nextAuthProof` is `undefined`, the server skips all verification (lines 106-117 of auth.ts). This means anyone who can discover a user's ID can call `linkOAuth` with `id`, `name`, and `email` to:
1. Create a new user record (if the user doesn't exist yet)
2. Create a session for that user
3. Effectively sign in as that user

The user ID from NextAuth is the `sub` claim in the JWT, which for GitHub/Google OAuth is the provider's user ID. These are often sequential or guessable.

**Recommendation:** Make proof verification mandatory. If the proof token is missing or invalid, reject the request with `UNAUTHORIZED`.

**Fix:**

```typescript
// In auth.ts, linkOAuth procedure:
linkOAuth: publicProcedure
  .input(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
      image: z.string().nullable(),
      nextAuthProof: z.string(), // REQUIRED — remove optional()
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Verify NextAuth proof token — REQUIRED
    const parts = input.nextAuthProof.split(".");
    if (parts.length !== 2) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid auth proof" });
    // ... rest of verification ...

    // If verification fails or token is missing, throw
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Auth proof is required" });
  }),
```

And in session-sync.ts, handle the proof fetch failure as a hard error rather than silently falling through:

```typescript
try {
  const proofRes = await fetch("/api/auth/issue-link-token", { method: "POST" });
  if (!proofRes.ok) {
    console.error("Failed to obtain auth proof token — OAuth link will be rejected");
    return; // Don't call linkMutation without proof
  }
  const proofData = await proofRes.json();
  nextAuthProof = proofData.token;
} catch {
  console.error("Auth proof endpoint unreachable — OAuth link will be rejected");
  return;
}
```

---

## Warnings

### WR-01: `checkSession()` is defined but never called — localStorage cache may be stale

**File:** `apps/web/src/stores/auth-store.ts:53-74`
**File:** `apps/web/src/app/providers.tsx:9-15`
**Issue:** The `checkSession()` method validates the session against the server by calling `auth.getSession`. If it fails (no session or expired), it clears `user` and removes the localStorage cache. However, **`checkSession()` is never called anywhere** in the initialization flow. Only `restoreSession()` is called, which reads from localStorage without server validation.

This means:
1. A user signs in → session created → user data cached in localStorage
2. Session expires (7-day TTL) → localStorage still has the stale data
3. User returns to dashboard → `restoreSession()` loads stale data → `authStore.user` is non-null
4. Page shows "Guest" header (from `profile` query returning null) and "Failed to load content"
5. User is confused — the app thought they were logged in but then showed errors

**Recommendation:** Call `checkSession()` after `restoreSession()` to validate the cached session against the server.

**Fix:**

```typescript
// apps/web/src/app/providers.tsx
function SessionRestorer({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const checkSession = useAuthStore((s) => s.checkSession);
  const user = useAuthStore((s) => s.user);
  
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);
  
  // After restoring from cache, validate with server
  useEffect(() => {
    if (user) {
      checkSession(); // Will update user to null if session expired
    }
  }, [user, checkSession]);
  
  return <>{children}</>;
}
```

---

### WR-02: React Query retries 401 queries 3 times — 4× unnecessary 401 requests

**File:** `apps/web/src/lib/trpc/provider.tsx:9` (implicit — no QueryClient defaults configured)
**File:** `apps/web/src/app/app/dashboard/page.tsx:15-22`
**Issue:** React Query's default `retry: 3` applies to all queries, including `profile.getProfile` and `profile.getStats`. When a user has no session, the initial request fails with 401, then React Query retries 3 more times (exponential backoff). The console shows the same 401 error 4 times per procedure.

Since the page makes 2 protected queries, that's **8 failed HTTP requests** before the error state stabilizes. If `tracks.getAll` and `warRoom.getLeaderboard` also had auth requirements (they're currently public, but this could change), it would be even worse.

This creates:
1. Console noise (dozens of red 401 errors)
2. Unnecessary API load
3. Slow error feedback for the user (retry backoff delays the error UI)

**Recommendation:** Configure QueryClient to skip retries for `UNAUTHORIZED` errors (combined with CR-02 fix). Additionally, stop retrying queries on the dashboard when a 401 occurs.

**Fix:** See CR-02 fix above (QueryClient retry configuration). Additionally, consider marking auth-protected tRPC queries with `retry: false`:

```typescript
const { data: profile, isLoading: profileLoading } =
  trpc.profile.getProfile.useQuery(undefined, {
    retry: false,
  });
```

Or better yet, add a `useAuthenticatedQuery` wrapper that disables retries and handles 401 redirects automatically.

---

### WR-03: Profile page renders null-safe data but crashes on `profile.name` when user is null

**File:** `apps/web/src/app/app/profile/page.tsx:44-48`
**Issue:** The early return at line 38-42 checks `if (!profile)` and shows a "not available" message. However this check is AFTER the `isLoading` and `isError` checks. If the session is valid but the API returns a 404 (user deleted between requests), or if `isError` is somehow false while `profile` is undefined, the component will reach the JSX at line 44 where it accesses `profile.name` without a guard.

While TypeScript's type narrowing should prevent this when `isError` is properly handled, the current logic has an issue: `isError` is `profileError || recentError || statsError`. If `recentError` or `statsError` is true but `profileError` is false, `isError` is true → error state shown. But if profile succeeds while the others fail, `isLoading` becomes false, `isError` is true → error state.

The real risk: if React Query's error state is reset by a refetch, `isError` could be false while `data` is still undefined (in between retries). This is unlikely with default behavior but represents a fragile state gap.

**Recommendation:** Use a guard for `profile` access or add a definitive null check before rendering.

**Fix:** Not critical, but consider:

```typescript
return (
  <>
    <PageHeader
      title={profile?.name ?? "User"}
      description={profile?.email ?? ""}
      ...
    />
    ...
    <p>Name: {profile?.name}</p>
    <p>Email: {profile?.email}</p>
    ...
  </>
);
```

---

### WR-04: `session-sync.ts` OAuth proof fetch error silently degrades security

**File:** `apps/web/src/components/app/session-sync.tsx:49-52`
**Issue:** When the proof endpoint fetch fails (network error, 500, etc.), the catch block comments "Fall back to legacy behavior if proof endpoint unavailable" and continues to call `linkMutation` with `nextAuthProof: undefined`. On the server side, the `optional()` input means this is accepted and the account linking proceeds without proof.

This "legacy behavior" fallback creates a window where:
1. Network blip → proof fetch fails
2. `linkMutation` is called without proof → server creates session
3. Account is linked with no verification

**Recommendation:** Remove the silent fallback. If proof can't be obtained, don't call `linkMutation`. The user can refresh the page to retry.

**Fix:** See CR-04 fix above. The compatibility concern (old clients without proof) doesn't apply since this is a new feature.

---

## Info

### IN-01: `extractSessionToken` regex requires exact cookie name — no handling of URL-encoded cookie values

**File:** `apps/api/src/context.ts:86`
**Issue:** The cookie regex matches the literal cookie name `unvibe_session_token`. If the cookie name is percent-encoded by some proxy or middleware (unlikely but possible with certain CDN configurations), the extraction fails silently, returning `null`, which causes `protectedProcedure` to throw 401.

**Recommendation:** This is a defense-in-depth observation. Consider adding a fallback that decodes the cookie name if the initial match fails.

---

### IN-02: `restoreSession` loads stale localStorage data before server validation

**File:** `apps/web/src/app/providers.tsx:9-15`
**File:** `apps/web/src/stores/auth-store.ts:40-51`
**Issue:** The `SessionRestorer` component sets `isLoading: false` after reading from localStorage (line 44: `set({ user: JSON.parse(stored), isLoading: false });`). This means the app signals "loaded" before the session is actually validated against the server. The tRPC queries in dashboard/profile fire immediately (lines 15-22 of page.tsx) while the auth-store may have stale data.

This creates a flash of incorrect UI: the AppShell briefly shows the old user's name from localStorage, then the tRPC queries fail with 401, and the error state replaces the content.

**Recommendation:** Either:
1. Don't cache user profile in localStorage at all (rely on tRPC queries for data)
2. Or set `isLoading: true` until `checkSession()` completes
3. Or delay tRPC queries until session validation is complete (see IN-04)

---

### IN-03: `page.tsx` uses `||` for `isError` — single failure masks all content

**File:** `apps/web/src/app/app/dashboard/page.tsx:25`
**File:** `apps/web/src/app/app/profile/page.tsx:19`
**Issue:** Both pages compute `isError = profileError || tracksError || ...` using `||`. If any single query fails, the entire page shows the error state, even if other queries succeeded. This is overly aggressive — the public procedures (`tracks.getAll`, `warRoom.getLeaderboard`) would succeed even for unauthenticated users, but their data is hidden behind the 401 error from the protected procedures.

**Recommendation:** Differentiate between critical failures (protected queries) and non-critical ones. Show partial content when public queries succeed but protected ones fail.

---

### IN-04: No session guard prevents tRPC queries from firing before auth initialization completes

**File:** `apps/web/src/app/app/dashboard/page.tsx:15-22`
**File:** `apps/web/src/stores/auth-store.ts:36-38`
**Issue:** The dashboard page fires all 4 tRPC queries unconditionally on mount. There's no check like:
```typescript
const { user, isLoading: authLoading } = useAuthStore();
if (authLoading) return <LoadingPanel />;
if (!user) { router.push("/auth/signin"); return null; }
```

The `authLoading` state exists in the auth-store (defaults to `true`) but is never used by pages. The AppShell renders user data (line 88: `user?.name ?? "Guest"`) but doesn't block rendering. This means all pages fire network requests before knowing whether the user is authenticated.

**Recommendation:** Add a session guard to the app layout that shows a loading state until `checkSession()` completes, then redirects to sign-in if no session exists. This eliminates the `isError` → "Failed to load" scenario entirely because protected pages simply don't render for unauthenticated users.

```typescript
// In app-shell.tsx or a separate SessionGuard component
function SessionGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/signin");
    }
  }, [isLoading, user, router]);

  if (isLoading) return <LoadingPanel />;
  if (!user) return null; // redirect in progress
  
  return <>{children}</>;
}
```

---

## Root Cause Analysis

The reported symptom — 3× `401 Unauthorized` for `/trpc/profile.getProfile,profile.getStats?batch=1` — is caused by a cascade:

```
Middleware (NextAuth only) → allows page load through (or doesn't run for client nav)
  → Dashboard renders client-side
    → tRPC queries fire for ALL 4 procedures (2 protected, 2 public)
      → Protected procedures call `extractSessionToken()` → no valid session → `null`
        → `isAuthenticated` middleware throws TRPCError UNAUTHORIZED
          → tRPC returns HTTP 401
            → React Query sees error, retries 3× default
              → 4 failed HTTP requests per procedure
                → Dashboard shows "Failed to load content"
```

Each of the 4 steps is fixable:

| Step | Fix | Priority |
|------|-----|----------|
| Middleware misses API session | Check `unvibe_session_token` cookie presence (CR-01) | Critical |
| No global 401 error link | Add error link to tRPC client (CR-02) | Critical |
| Pages show error instead of redirecting | Check for UNAUTHORIZED in error state (CR-03) | Critical |
| React Query retries 401s | Configure retry: false for UNAUTHORIZED (WR-02) | Warning |

---

## Recommended Fix Order

1. **CR-02** (global tRPC error link) + **WR-02** (disable retries for 401)
   - Catches ALL 401 errors app-wide, not just dashboard/profile
   - Single change with maximum impact

2. **CR-01** (middleware check for API session cookie)
   - Fixes email/password refresh redirect loop

3. **CR-03** (dashboard/profile 401 check before error display)
   - Defense-in-depth for page-level handling

4. **WR-01** (call `checkSession()` during initialization)
   - Prevents stale localStorage cache from showing incorrect auth state

5. **CR-04** (make OAuth proof mandatory)
   - Security hardening for `linkOAuth` endpoint

---

_Reviewed: 2026-07-03T12:00:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: deep_
