---
phase: auth-system
reviewed: 2026-07-02T10:00:00Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - apps/api/src/routers/auth.ts
  - apps/api/src/trpc.ts
  - apps/api/src/context.ts
  - apps/api/src/index.ts
  - apps/api/prisma/schema.prisma
  - apps/api/package.json
  - apps/web/src/auth.ts
  - apps/web/src/app/api/auth/[...nextauth]/route.ts
  - apps/web/src/app/auth/signin/page.tsx
  - apps/web/src/app/auth/signup/page.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/providers.tsx
  - apps/web/src/app/app/layout.tsx
  - apps/web/src/app/app/dashboard/page.tsx
  - apps/web/src/stores/auth-store.ts
  - apps/web/src/lib/trpc/provider.tsx
  - apps/web/src/middleware.ts
  - apps/web/next.config.mjs
  - .env.local
  - .env.example
findings:
  critical: 5
  warning: 8
  info: 4
  total: 17
status: issues_found
---

# Authentication System — Comprehensive Code Review

**Reviewed:** 2026-07-02T10:00:00Z
**Depth:** deep (cross-file analysis)
**Files Reviewed:** 18 (including all backend routers, frontend pages, stores, providers, middleware, config, and schema)
**Status:** issues_found

## Executive Summary

This codebase contains **two parallel, incompatible authentication systems** that do not integrate with each other:

1. **Custom tRPC auth** (email/password) — stores sessions in DB `Session` table, uses Bearer tokens in `localStorage`
2. **NextAuth v5** (OAuth: GitHub, Google) — uses JWT sessions in cookies, has NO database adapter configured

Neither system works correctly end-to-end. The email/password flow is blocked by NextAuth middleware. The OAuth flow creates sessions NextAuth recognizes but the Express API doesn't. The two systems have no bridge to share session state.

**The user reports "Google sign-in is not working" and "setting up sign-in with email and other shit is broken" — both issues are confirmed and explained below.**

---

## CRITICAL ISSUES

### CR-01: NextAuth middleware blocks ALL authenticated routes for email/password users

**Files:** `apps/web/src/middleware.ts:1`, `apps/web/src/auth.ts:5`
**Lines:** middleware.ts:1, auth.ts:5

**Issue:**
The middleware exports NextAuth's `auth()` as the default middleware, matching all routes except `/api`, `/_next/static`, `/_next/image`, and `/favicon.ico`:

```typescript
// middleware.ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

When a user signs in with email/password:
1. Custom tRPC auth returns a session token stored in `localStorage`
2. User navigates to `/app/dashboard`
3. **NextAuth middleware runs** — checks for `authjs.session-token` cookie (NextAuth JWT)
4. No NextAuth cookie exists → `auth()` considers user unauthenticated
5. **User is redirected to `/auth/signin`** — creating an infinite loop if they keep signing in

The email/password auth system has no way to create a NextAuth session, so ALL protected pages are blocked for email/password users.

**Fix:**
**Option A** (recommended): Remove the NextAuth middleware entirely, or constrain it to only protect routes that should be guarded by NextAuth. The custom auth-store handles its own auth checks.

```typescript
// middleware.ts — either remove entirely or use a minimal passthrough
export { auth as middleware } from "@/auth";

export const config = {
  // Only protect API routes that need NextAuth session, not app pages
  matcher: ["/api/nextauth/:path*"],
};
```

**Option B** (if you want unified middleware): In the middleware, check both NextAuth session AND localStorage token, or skip middleware for routes handled by the custom auth.

---

### CR-02: NextAuth OAuth sessions are invisible to the Express tRPC API (OAuth login is completely broken)

**Files:** `apps/web/src/auth.ts:5-15`, `apps/api/src/context.ts:42-63`, `apps/api/src/context.ts:72-87`
**Lines:** auth.ts:5-15, context.ts:42-63, context.ts:72-87

**Issue:**
After OAuth sign-in via NextAuth:
1. NextAuth creates a **JWT session** stored in a cookie (`authjs.session-token` or `__Secure-authjs.session-token`)
2. The user is redirected to `/app/dashboard`
3. Dashboard calls `trpc.profile.getProfile.useQuery()` (a `protectedProcedure`)
4. The tRPC HTTP request goes to the Express API at `localhost:3001`
5. `context.ts` extracts the cookie value via `extractSessionToken()`
6. **`resolveSession()` looks up the extracted value in `prisma.session.findUnique()`**
7. **No matching session exists** — NextAuth uses JWT strategy by default (no database adapter), so there's no `Session` record
8. `session` is `null` → `protectedProcedure` throws `UNAUTHORIZED`

The cookie value from NextAuth is a JWT, NOT a database session token. The Express API treats it as a session token and finds nothing.

Additionally, the CORS configuration blocks cookie transmission:

```typescript
// index.ts:154
app.use(cors());  // No credentials: true → cookies NOT sent cross-origin
```

The frontend is on `localhost:3000`, API on `localhost:3001`. Without `credentials: 'include'` on fetch requests and `Access-Control-Allow-Credentials: true` in CORS, the browser **never sends cookies** to the API. So the cookie fallback in `extractSessionToken` never works for cross-origin requests anyway.

**Fix:**
Several things must happen together:

```typescript
// 1. apps/web/src/auth.ts — Add PrismaAdapter
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma"; // YOU NEED TO CREATE THIS

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma), // ← CRITICAL: creates DB sessions
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
});
```

```typescript
// 2. apps/api/src/index.ts — Fix CORS to allow credentials
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
```

```typescript
// 3. apps/web/src/lib/trpc/provider.tsx — Send cookies with requests
httpBatchLink({
  url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/trpc`,
  fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
  headers: () => {
    // ... existing localStorage logic
  },
}),
```

But wait — even with the PrismaAdapter, the cookie value set by NextAuth is a **session token ID** (UUID-like), which would match the `sessionToken` field in the `Session` table. So `resolveSession` in `context.ts` would find it. This would work.

However, there's still a timing issue: the PrismaAdapter only creates a `Session` record when `useSession()` is called or a database callback runs. The initial OAuth callback might create the session, but the redirect to the dashboard happens before the tRPC API can see it. This needs careful testing.

---

### CR-03: auth-store `signOut` with `localStorage.removeItem` doesn't clear NextAuth cookies

**Files:** `apps/web/src/stores/auth-store.ts:116-132`, `apps/web/src/components/app/app-shell.tsx:24-27`
**Lines:** auth-store.ts:116-132, app-shell.tsx:24-27

**Issue:**
The sign-out button in `AppShell` calls `useAuthStore().signOut()` which:
1. Calls the API's `auth.signOut` (deletes the session from DB)
2. Clears `localStorage`

But it does NOT sign the user out of NextAuth. If the user signed in via OAuth, the NextAuth session cookie persists. On the next page load, the NextAuth middleware redirects to `/auth/signin` even though the user clicked "Sign out". More critically, the user is never actually redirected away — they see local state cleared but the OAuth session still exists.

```typescript
// app-shell.tsx:24
const handleSignOut = async () => {
  await signOut();          // Custom signOut — clears localStorage
  router.push("/auth/signin");
};
```

There's no call to NextAuth's `signOut()` from `next-auth/react`.

**Fix:**

```typescript
// app-shell.tsx
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useAuthStore } from "@/stores/auth-store";

const handleSignOut = async () => {
  await signOut();           // Custom signOut — clear localStorage + API
  await nextAuthSignOut({ redirect: false });  // NextAuth signOut — clear cookie
  router.push("/auth/signin");
};
```

---

### CR-04: The `signIn` tRPC procedure creates DB sessions but never sets cookies — NextAuth middleware still blocks

**Files:** `apps/api/src/routers/auth.ts:39-48`, `apps/web/src/middleware.ts:1`
**Lines:** auth.ts:39-48, middleware.ts:1

**Issue:**
Even if the tRPC email/password sign-in succeeds (creates DB session, returns token, client stores it in localStorage), NextAuth middleware still runs on every page navigation and checks for a NextAuth session cookie — which doesn't exist. The user is redirected to sign-in the moment they try to access any page behind the middleware.

This makes the entire email/password flow **completely non-functional** as long as the NextAuth middleware is active on all routes.

**Fix:**
See CR-01 fix — the middleware must be removed or scoped to only routes that NextAuth should protect. The custom tRPC auth system handles its own authorization via `protectedProcedure`.

---

### CR-05: `profile.getStats` and `profile.getProfile` are called without authentication check/redirect on dashboard

**Files:** `apps/web/src/app/app/dashboard/page.tsx:16-19`, `apps/web/src/lib/trpc/provider.tsx:14-15`
**Lines:** dashboard/page.tsx:16-19, provider.tsx:14-15

**Issue:**
The dashboard page fires four tRPC queries on mount, two of which (`getProfile`, `getStats`) use `protectedProcedure`. If the session is invalid/expired:
1. React Query catches the error, `data` stays `undefined`
2. The page renders with fallback values (0, "--", empty)
3. **User sees a broken-looking dashboard** instead of being redirected to sign-in
4. No error boundary, no redirect logic

Combined with CR-01, this means:
- Email/password user signs in → token in localStorage → dashboard loads → NextAuth middleware redirects to /auth/signin before dashboard renders
- OAuth user signs in → cookie exists → middleware passes → dashboard fires tRPC calls → API returns 401 → dashboard renders with undefined data → user sees empty dashboard

**Fix:**

```typescript
// apps/web/src/app/app/dashboard/page.tsx
export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  
  // Wait for auth store to initialize
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, isLoading, router]);

  if (isLoading) return <LoadingPanel />;
  if (!user) return null; // Will redirect in effect

  // ...rest of component
}
```

Also add a global error boundary in `providers.tsx` or layout that catches UNAUTHORIZED tRPC errors and redirects.

---

## WARNINGS

### WR-01: NextAuth OAuth client env vars are empty — NextAuth may crash on startup

**File:** `.env.local:14-19`
**Lines:** 14-19

**Issue:**
```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

NextAuth v5 providers throw an error at initialization when `clientId` or `clientSecret` is an empty string. The `auth.ts` config passes these directly:

```typescript
GitHub({
  clientId: process.env.GITHUB_CLIENT_ID,     // empty string ""
  clientSecret: process.env.GITHUB_CLIENT_SECRET, // empty string ""
}),
```

This will likely cause a runtime error when NextAuth initializes, potentially crashing the entire auth system including the route handler at `/api/auth/[...nextauth]/route.ts`. Even the email/password flow would break if NextAuth fails to initialize.

**Fix:**
Conditionally add providers only when credentials are available:

```typescript
providers: [
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    : null,
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    : null,
].filter(Boolean),
```

Or use non-null assertion only after validation:
```typescript
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("Google OAuth credentials not configured");
}
```

---

### WR-02: `redirectTo` parameter in OAuth buttons is silently ignored

**Files:** `apps/web/src/app/auth/signin/page.tsx:58-65`, `apps/web/src/app/auth/signup/page.tsx:63-70`
**Lines:** signin/page.tsx:58-65, signup/page.tsx:63-70

**Issue:**
Both sign-in and sign-up pages call `oauthSignIn` with `{ redirectTo: "/app/dashboard" }`:

```typescript
onClick={() => oauthSignIn("github", { redirectTo: "/app/dashboard" })}
```

NextAuth v5's `signIn()` from `next-auth/react` accepts `callbackUrl`, **not** `redirectTo`. The `redirectTo` parameter is silently ignored. The user will be redirected to the default callback URL after OAuth sign-in — which is typically the page that initiated the sign-in (the sign-in page itself, creating a redirect loop back to sign-in).

**Fix:**

```typescript
onClick={() => oauthSignIn("github", { callbackUrl: "/app/dashboard" })}
```

---

### WR-03: CORS configuration doesn't allow credential transmission

**File:** `apps/api/src/index.ts:154`
**Line:** 154

**Issue:**
```typescript
app.use(cors());  // Default: allows all origins, NO credentials
```

When the frontend at `localhost:3000` makes a fetch request to `localhost:3001`:
- Without `credentials: 'include'` on the request AND `Access-Control-Allow-Credentials: true` on the response, the browser **will not send cookies**
- The cookie-based session fallback in `extractSessionToken()` (`context.ts:49-60`) can never work cross-origin
- This means the Auth.js cookie is never available to the Express API

**Fix:**
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
```

Also update the tRPC provider and auth-store to send credentials:
```typescript
// provider.tsx — inside httpBatchLink
fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),

// auth-store.ts — inside signIn, signUp, checkSession, signOut
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // ← add this
  body: JSON.stringify(...),
});
```

---

### WR-04: `restoreSession` trusts localStorage without server validation

**Files:** `apps/web/src/stores/auth-store.ts:29-40`, `apps/web/src/app/providers.tsx:7-13`
**Lines:** auth-store.ts:29-40, providers.tsx:7-13

**Issue:**
On app load, `providers.tsx` calls `restoreSession()` which reads `localStorage` and sets the user state **without validating the session with the server**:

```typescript
restoreSession: () => {
  try {
    const stored = localStorage.getItem("unvibe_session");
    if (stored) {
      set({ user: JSON.parse(stored), isLoading: false });
    } else {
      set({ isLoading: false });
    }
  } catch {
    set({ isLoading: false });
  }
},
```

This means:
- If the session expired on the server, the user still appears logged in
- If the localStorage data is corrupted/manipulated, the app state is compromised
- The `checkSession` method does validate with the server but is **never called** anywhere in the codebase (only exported)

**Fix:**
Replace `restoreSession` with a call to `checkSession`:

```typescript
// providers.tsx
function SessionRestorer({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((s) => s.checkSession);
  useEffect(() => {
    checkSession(); // Validates with server instead of trusting localStorage
  }, [checkSession]);
  return <>{children}</>;
}
```

---

### WR-05: No error boundary for OAuth failures

**Files:** `apps/web/src/app/auth/signin/page.tsx:58-65`, `apps/web/src/app/auth/signup/page.tsx:63-70`
**Lines:** signin/page.tsx:58-65, signup/page.tsx:63-70

**Issue:**
The OAuth buttons use `oauthSignIn()` which redirects to the OAuth provider. If the OAuth flow fails (user denies, provider error, misconfiguration), NextAuth redirects back to the sign-in page with error parameters in the URL (e.g., `?error=AccessDenied` or `?error=OAuthSignin`). Neither page checks for these search parameters:

```typescript
// signin/page.tsx — no error handling for OAuth callback errors
```

The error is completely invisible to the user — they just see the blank sign-in form with no explanation.

**Fix:**
```typescript
export default function SignInPage() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  
  // Map NextAuth error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    OAuthSignin: "OAuth sign-in failed. Please try again.",
    OAuthCallback: "OAuth callback failed. Please try again.",
    OAuthAccountNotLinked: "This account is already linked to a different provider.",
    AccessDenied: "Access denied. You may need to accept the permissions request.",
    // ... etc
  };

  // ... render with error display
  {oauthError && <p className="text-sm text-destructive">{errorMessages[oauthError] || "Authentication failed."}</p>}
}
```

---

### WR-06: Generic error messages swallow specific error details

**Files:** `apps/web/src/app/auth/signin/page.tsx:38`, `apps/web/src/app/auth/signup/page.tsx:43`, `apps/web/src/stores/auth-store.ts:64-88`
**Lines:** signin/page.tsx:38, signup/page.tsx:43, auth-store.ts:64-88

**Issue:**
The auth-store's `signIn` and `signUp` return `false` for any error — network failure, wrong password, user not found, server down, all become the same generic message:

```typescript
// auth-store.ts:84-86
} catch {
  return false;
}
```

The UI shows: "Could not sign in. Check your credentials." even if the server is down.

**Fix:**
Propagate specific error messages:

```typescript
// auth-store.ts
signIn: async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(...);
    const json = await res.json();
    if (json?.result?.data?.user && json?.result?.data?.sessionToken) {
      // ... set user state
      return { ok: true };
    }
    // Extract tRPC error message
    const errorMsg = json?.error?.message || json?.error?.json?.message || "Sign-in failed";
    return { ok: false, error: errorMsg };
  } catch (e) {
    return { ok: false, error: "Network error. Check your connection." };
  }
},
```

---

### WR-07: No rate limiting on auth endpoints (brute-force risk)

**Files:** `apps/api/src/routers/auth.ts:16-49`, `apps/api/src/routers/auth.ts:51-84`
**Lines:** auth.ts:16-49, auth.ts:51-84

**Issue:**
The `signIn` and `signUp` procedures have no rate limiting. An attacker can:
1. Brute-force passwords on the sign-in endpoint
2. Mass-register accounts on the sign-up endpoint
3. Enumerate valid email addresses via the "User not found" vs "Invalid password" distinction

The different error messages for "user not found" (NOT_FOUND) vs "invalid password" (UNAUTHORIZED) enable email enumeration.

**Fix:**
```typescript
// Option 1: Use consistent error messages
if (!user)
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });

// Always use UNAUTHORIZED regardless of whether user exists or password is wrong
const valid = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
if (!valid)
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });

// Option 2: Add rate limiting middleware (e.g., express-rate-limit)
```

---

### WR-08: `signUp` doesn't auto-sign-in for OAuth users; email/password sign-up doesn't create NextAuth-compatible session

**Files:** `apps/api/src/routers/auth.ts:69-84`, `apps/web/src/stores/auth-store.ts:90-114`
**Lines:** auth.ts:69-84, auth-store.ts:90-114

**Issue:**
After signing up with email/password:
1. A DB session is created
2. The session token is returned and stored in `localStorage`
3. User is redirected to `/app/dashboard`
4. NextAuth middleware blocks them (see CR-01)

The sign-up creates a custom tRPC session but no NextAuth session. The user will never be able to access dashboard pages behind NextAuth middleware.

**Fix:**
After sign-up, also create a NextAuth-compatible session, or (better) remove the NextAuth middleware from frontend routes (see CR-01 fix).

---

## INFO / SUGGESTIONS

### IN-01: `NEXT_PUBLIC_API_URL` is missing from `.env.local` but referenced in code

**Files:** `.env.local:1-19`, `.env.example:38`
**Lines:** .env.example:38

**Issue:**
The `.env.example` has `NEXT_PUBLIC_API_URL="http://localhost:3000"` which is WRONG (port 3000 is Next.js, not the API on 3001). The actual `.env.local` is missing this variable entirely. The code defaults to `localhost:3001` correctly, but this is fragile and not documented.

**Fix:**
Add to `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```
And fix `.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### IN-02: Two incompatible auth systems should be unified

**Files:** All reviewed files

**Issue:**
The project has two completely separate auth implementations:
1. **Custom tRPC auth** (`auth.ts` router + `auth-store.ts`) — email/password with custom DB sessions
2. **NextAuth v5** (`auth.ts` config + OAuth providers) — OAuth with JWT sessions

Each creates its own session store, uses different credential storage (localStorage vs cookies), and has incompatible session formats. No bridge exists between them.

This creates massive complexity for every feature:
- Which session does a page check?
- Which signOut clears both sessions?
- What happens when both sessions exist?

**Suggestion:**
Pick ONE auth system as the source of truth:

**Recommended approach:** Keep NextAuth as the auth framework (handles OAuth + credentials), use PrismaAdapter for persistent sessions, and have the Express API read NextAuth's session cookie directly by sharing the `NEXTAUTH_SECRET` and using `jwt.decode()` to verify the NextAuth JWT.

**Alternative approach:** Drop NextAuth entirely, build OAuth handling into the Express API using `passport` or manual OAuth2 flow, and have the Next.js app only use the custom tRPC auth.

---

### IN-03: `checkSession` is never called — dead code path

**File:** `apps/web/src/stores/auth-store.ts:42-62`
**Line:** 42

**Issue:**
The `checkSession` method is exported from the store and makes a server-side validation call, but it is **never invoked** anywhere in the codebase. Only `restoreSession` (which trusts `localStorage` blindly) is called.

**Fix:**
Either remove `checkSession` if unused, or replace `restoreSession` with `checkSession` (see WR-04).

---

### IN-04: Sign-in/sign-up pages have no `callbackUrl` support

**Files:** `apps/web/src/app/auth/signin/page.tsx:36`, `apps/web/src/app/auth/signup/page.tsx:41`
**Lines:** signin/page.tsx:36, signup/page.tsx:41

**Issue:**
After successful sign-in, both pages hardcode the redirect to `/app/dashboard`. This ignores any `callbackUrl` parameter in the URL, which NextAuth typically appends when redirecting unauthenticated users.

**Fix:**

```typescript
const searchParams = useSearchParams();
const callbackUrl = searchParams.get("callbackUrl") || "/app/dashboard";

// After successful sign-in:
router.push(callbackUrl);
```

---

## Architecture Diagram

```
                         Frontend (Next.js :3000)
                         ======================
                          │                      │
                          │ OAuth buttons        │ Email/password form
                          ▼                      ▼
                   ┌──────────────┐    ┌──────────────────┐
                   │  NextAuth    │    │  auth-store.ts   │
                   │  signIn()    │    │  (Zustand store) │
                   │              │    │                  │
                   │ Creates JWT  │    │  Stores token in │
                   │ cookie:      │    │  localStorage    │
                   │ authjs.      │    │                  │
                   │ session-token│    │  Sends Bearer    │
                   └──────┬───────┘    │  header to API   │
                          │            └────────┬─────────┘
                          │                      │
                    ┌─────▼──────────────────────▼──────┐
                    │         Next.js Middleware         │
                    │  middleware.ts: auth() from next-  │
                    │  auth → checks for NextAuth cookie │
                    │  → BLOCKS email/password users     │
                    └─────────────────┬──────────────────┘
                                      │ HTTP request
                                      │ (cookies NOT sent
                                      │  cross-origin)
                    ┌─────────────────▼──────────────────┐
                    │   Express API (Express :3001)       │
                    │                                     │
                    │  context.ts: extractSessionToken()  │
                    │   1. Check Authorization header     │
                    │   2. Check Cookie (never works      │
                    │      cross-origin without CORS)     │
                    │                                     │
                    │  resolveSession():                  │
                    │   Look up token in Session table    │
                    │   → NextAuth JWT not found          │
                    │   → session = null                  │
                    │   → protectedProcedure throws 401   │
                    └─────────────────┬──────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │       PostgreSQL Database           │
                    │                                     │
                    │  Session table: has custom sessions │
                    │  (from tRPC auth) but NO NextAuth   │
                    │  sessions (no PrismaAdapter)        │
                    │                                     │
                    │  Account table: empty (no adapter)  │
                    └─────────────────────────────────────┘
```

---

## Summary of Required Fixes (Priority Order)

| Priority | ID | Description | Effort |
|----------|-----|-------------|--------|
| P0 | CR-01 | Remove/scope NextAuth middleware or it blocks ALL email/password users | 5 min |
| P0 | CR-02 | Add PrismaAdapter to NextAuth + fix CORS + fix fetch credentials | 30 min |
| P0 | CR-03 | Fix signOut to clear NextAuth cookies too | 5 min |
| P0 | CR-04 | Blocked by CR-01 — middleware makes email/password auth impossible | 0 min (depends on CR-01) |
| P1 | CR-05 | Dashboard needs auth redirect guard | 15 min |
| P1 | WR-01 | Protect against empty OAuth env vars crashing NextAuth | 5 min |
| P1 | WR-02 | Fix `redirectTo` → `callbackUrl` for OAuth redirect | 2 min |
| P1 | WR-03 | Fix CORS + fetch credentials for cross-origin cookie support | 10 min |
| P2 | WR-04 | Validate session with server on app load (replace restoreSession) | 10 min |
| P2 | WR-05 | Handle OAuth callback errors in sign-in/sign-up pages | 15 min |
| P2 | WR-06 | Propagate specific error messages from auth store | 15 min |
| P2 | WR-07 | Rate limit auth endpoints + consistent error messages | 20 min |
| P3 | WR-08 | Post-sign-up session bridging | 5 min |
| P3 | IN-01-04 | Improvements and cleanup | Various |

---

_Reviewed: 2026-07-02_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: deep_
