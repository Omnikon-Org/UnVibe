---
phase: full-project-review
reviewed: 2026-07-02T16:00:00Z
depth: deep
files_reviewed: 58
files_reviewed_list:
  - apps/api/src/index.ts
  - apps/api/src/context.ts
  - apps/api/src/trpc.ts
  - apps/api/src/routers/auth.ts
  - apps/api/src/routers/tracks.ts
  - apps/api/src/routers/modules.ts
  - apps/api/src/routers/irs.ts
  - apps/api/src/routers/warRoom.ts
  - apps/api/src/routers/submissions.ts
  - apps/api/src/routers/profile.ts
  - apps/api/src/routers/judge0.ts
  - apps/api/src/services/ai-client.ts
  - apps/api/src/services/irs-engine.ts
  - apps/api/src/services/judge0-client.ts
  - apps/api/src/services/submission-worker.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/seed.ts
  - apps/api/package.json
  - apps/api/tsconfig.json
  - apps/api/Dockerfile
  - apps/web/src/auth.ts
  - apps/web/src/middleware.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/page.tsx
  - apps/web/src/app/providers.tsx
  - apps/web/src/app/globals.css
  - apps/web/src/app/app/layout.tsx
  - apps/web/src/app/app/page.tsx
  - apps/web/src/app/app/dashboard/page.tsx
  - apps/web/src/app/app/dashboard/loading.tsx
  - apps/web/src/app/app/dashboard/error.tsx
  - apps/web/src/app/app/tracks/page.tsx
  - apps/web/src/app/app/tracks/error.tsx
  - apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/page.tsx
  - apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/loading.tsx
  - apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/error.tsx
  - apps/web/src/app/app/profile/page.tsx
  - apps/web/src/app/app/profile/loading.tsx
  - apps/web/src/app/app/profile/error.tsx
  - apps/web/src/app/app/blindspot-map/page.tsx
  - apps/web/src/app/app/blindspot-map/loading.tsx
  - apps/web/src/app/app/blindspot-map/error.tsx
  - apps/web/src/app/app/war-room/page.tsx
  - apps/web/src/app/app/war-room/loading.tsx
  - apps/web/src/app/app/war-room/error.tsx
  - apps/web/src/app/auth/signin/page.tsx
  - apps/web/src/app/auth/signin/error.tsx
  - apps/web/src/app/auth/signup/page.tsx
  - apps/web/src/app/api/auth/[...nextauth]/route.ts
  - apps/web/src/lib/trpc/client.ts
  - apps/web/src/lib/trpc/hooks.ts
  - apps/web/src/lib/trpc/provider.tsx
  - apps/web/src/lib/socket/client.ts
  - apps/web/src/lib/utils.ts
  - apps/web/src/stores/auth-store.ts
  - apps/web/src/stores/editor-store.ts
  - apps/web/src/stores/ui-store.ts
  - apps/web/src/components/app/session-sync.tsx
  - apps/web/src/components/app/app-shell.tsx
  - apps/web/src/components/app/skeleton.tsx
  - apps/web/src/components/app/error-fallback.tsx
  - apps/web/src/components/app/loading-panel.tsx
  - apps/web/src/components/app/page-header.tsx
  - apps/web/src/components/app/theme-controller.tsx
  - apps/web/src/components/app/theme-provider.tsx
  - apps/web/src/components/features/module-player.tsx
  - apps/web/src/components/features/code-editor.tsx
  - apps/web/src/components/features/code-submission.tsx
  - apps/web/src/components/features/annotation-editor.tsx
  - apps/web/src/components/features/diff-viewer.tsx
  - apps/web/src/components/features/irs-radar-chart.tsx
  - apps/web/src/components/features/leaderboard.tsx
  - apps/web/src/components/features/quiz-ui.tsx
  - apps/web/src/components/features/streak-tracker.tsx
  - apps/web/src/components/features/war-room-live.tsx
  - apps/web/src/components/ui/badge.tsx
  - apps/web/src/components/ui/button.tsx
  - apps/web/src/components/ui/card.tsx
  - apps/web/src/components/ui/input.tsx
  - apps/web/src/components/ui/progress.tsx
  - apps/web/src/components/ui/textarea.tsx
  - apps/web/next.config.mjs
  - apps/web/package.json
  - apps/web/tsconfig.json
  - apps/ai-service/app/main.py
  - apps/ai-service/app/config.py
  - packages/types/src/index.ts
  - packages/types/package.json
  - infra/docker-compose.yml
  - .env.example
  - tsconfig.base.json
  - turbo.json
findings:
  critical: 4
  warning: 12
  info: 8
  total: 24
status: issues_found
---

# Full Project Code Review Report

**Reviewed:** 2026-07-02T16:00:00Z
**Depth:** deep (cross-file analysis)
**Files Reviewed:** 58
**Status:** issues_found

## Summary

A comprehensive review of the UnVibe monorepo found **4 critical**, **12 warning**, and **8 info** issues.

The most severe findings are in the authentication system: the OAuth bridging endpoint (`linkOAuth`) has **zero authentication** — any network actor can forge user data and obtain a valid session token. The `SessionSync` component has a logic error that immediately clears email/password sessions. A misconfigured default URL (`localhost:4000` instead of `3001`) makes all Socket.io connections fail. The `.env.example` points `NEXT_PUBLIC_API_URL` to the wrong port (3000 instead of 3001), breaking all API communication for first-time setup.

Secondary concerns include duplicated IRS calculation logic, a broken streak calculation, zombie submissions created without transaction safety, and several type-safety escape hatches that mask real bugs.

---

## Critical Issues

### CR-01: `linkOAuth` Endpoint Allows Unauthenticated Session Creation

**File:** `apps/api/src/routers/auth.ts:91-133`

**Issue:** The `linkOAuth` procedure is declared as `publicProcedure` (no authentication required) and accepts arbitrary user data (`id`, `name`, `email`, `image`) from any caller. An attacker who knows or guesses a valid user ID or email can:

1. Call `POST /trpc/auth.linkOAuth` with that ID/email
2. Receive a valid `sessionToken` in response
3. Use that token to impersonate the victim across all protected API endpoints

The intended design is that this endpoint is called by the frontend `SessionSync` component *after* NextAuth OAuth completes. **However, there is no verification that the NextAuth session is valid.** The API has no way to independently verify the session — it blindly trusts whatever data is sent.

**Severity:** CRITICAL — Authentication bypass allowing full account takeover.

**Fix:** The `linkOAuth` endpoint must verify the caller's identity. Options:

1. **Recommended:** Require the NextAuth JWT as a signed proof. Parse and verify the `next-auth.session-token` cookie server-side to extract the authenticated user's actual ID/email from the JWT, and reject mismatches:

```typescript
// apps/api/src/routers/auth.ts
import { jwtDecode } from "jwt-decode"; // or use jose to verify

linkOAuth: publicProcedure
  .input(z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify the caller's NextAuth JWT from the cookie
    const cookieHeader = req.headers.cookie;
    const jwtMatch = cookieHeader?.match(/(?:^|;\s*)next-auth\.session-token=([^;]+)/);
    if (!jwtMatch) throw new TRPCError({ code: "UNAUTHORIZED", message: "No NextAuth session" });

    const decoded = jwtDecode(jwtMatch[1]) as { sub?: string; email?: string };
    if (decoded.sub !== input.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "User ID mismatch" });
    }
    // ... proceed
  }),
```

2. **Alternative (simpler, less secure):** Use `protectedProcedure` and share the session token between NextAuth and the API, so the endpoint requires an existing session.

---

### CR-02: `SessionSync` Immediately Clears Email/Password User Sessions

**File:** `apps/web/src/components/app/session-sync.tsx:63-67`

**Issue:** The second `useEffect` in `SessionSync` clears the local session when `status === "unauthenticated"` and the session token does not start with `"oauth_"`. 

For users who signed in via email/password (the custom auth store flow), `useSession()` from NextAuth is always `"unauthenticated"` because they never authenticated via NextAuth. The session token from the custom auth is a random hex string (does not start with `"oauth_"`). This means:

- A user signs in via email/password → `useAuthStore` sets the user → `status` = `"unauthenticated"` → `authUser` is non-null → condition is **true** → `clearLocal()` fires → user is immediately logged out.

**This makes email/password authentication completely non-functional** — users cannot stay signed in.

**Severity:** CRITICAL — Email/password authentication is broken.

**Fix:** The cleanup logic should only apply to OAuth users. Use the `signIn` method from the store to differentiate:

```typescript
// apps/web/src/components/app/session-sync.tsx
useEffect(() => {
  // Only clear local session if user came from OAuth (NextAuth)
  if (status === "unauthenticated" && authUser && !authUser.sessionToken?.startsWith("oauth_")) {
    // Check if this user had ever synced via OAuth
    const method = localStorage.getItem("unvibe_auth_method");
    if (method === "oauth") {
      clearLocal();
    }
  }
}, [status, authUser, clearLocal]);
```

And in the OAuth linking success handler:
```typescript
localStorage.setItem("unvibe_auth_method", "oauth");
```

A simpler fix: remove the second effect entirely and let the OAuth-only cleanup happen only if the first useEffect's `linkMutation` ever succeeded (track via a ref).

---

### CR-03: Socket.io Client Defaults to Wrong Port (4000 instead of 3001)

**File:** `apps/web/src/lib/socket/client.ts:9`

**Issue:** The Socket.io client default URL is `http://localhost:4000`, but the Socket.io server is mounted on the Express HTTP server at port **3001** (defined in `apps/api/src/index.ts:181-184`). Port 4000 serves nothing in the project.

All Socket.io connections silently fail unless `NEXT_PUBLIC_API_URL` is explicitly set to a URL with the correct port. Even then, the configuration is fragile.

**Severity:** CRITICAL — All real-time functionality (War Room, live updates) is broken by default.

**Fix:**

```typescript
// apps/web/src/lib/socket/client.ts
export function getSocket() {
  if (!socket) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    socket = io(apiUrl, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
}
```

---

### CR-04: `.env.example` Has Wrong `NEXT_PUBLIC_API_URL` Port

**File:** `.env.example:38`

**Issue:** The example environment file sets `NEXT_PUBLIC_API_URL="http://localhost:3000"`, but the API server runs on **port 3001** (the web frontend runs on 3000). Anyone who copies `.env.example` to `.env.local` will have a fully broken setup — all API calls from the frontend (auth, tracks, submissions, etc.) will fail because they're directed at the web dev server, not the API.

**Severity:** CRITICAL — First-time setup is broken for anyone following the documented example.

**Fix:**

```diff
- NEXT_PUBLIC_API_URL="http://localhost:3000"
+ NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## Warnings

### WR-01: Auth Timing Attack via Distinct Error Messages

**File:** `apps/api/src/routers/auth.ts:24-37`

**Issue:** The `signIn` procedure returns different error codes and messages for "email not found" (`NOT_FOUND`) vs. "invalid password" (`UNAUTHORIZED`). This lets an attacker enumerate registered email addresses by observing the response code. Combined with the public `linkOAuth` endpoint (CR-01), this is a significant information disclosure vector.

**Severity:** WARNING

**Fix:** Use a single generic error for both cases:

```typescript
signIn: publicProcedure
  .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
    }
    // ... create session
  }),
```

---

### WR-02: Streak Calculation Only Returns 0 or 1 (Not a Real Streak)

**File:** `apps/api/src/routers/profile.ts:112-116`

**Issue:** The streak logic only examines the *last* submission date. If `daysSince <= 1`, it returns 1; otherwise 0. This means:
- A user who submitted every day for 30 days has a streak of **1**, not 30.
- A user who submitted yesterday gets 1, but if they also submitted the day before, the count does not increase.

Essentially, the streak counter is broken — it cannot compute streaks longer than 1 day.

**Severity:** WARNING

**Fix:** Fetch all submissions ordered by date and count consecutive days:

```typescript
// apps/api/src/routers/profile.ts
const submissions = await ctx.prisma.submission.findMany({
  where: { userId },
  orderBy: { createdAt: "desc" },
  select: { createdAt: true },
  distinct: ["createdAt"],
});

let currentStreak = 0;
const seen = new Set<string>();
for (const sub of submissions) {
  const dateKey = sub.createdAt.toISOString().split("T")[0];
  if (seen.has(dateKey)) continue;
  seen.add(dateKey);
  if (currentStreak === 0) {
    currentStreak = 1;
  } else {
    // Check if the date is consecutive with the previous
    // ... proper consecutive date logic
  }
}
```

---

### WR-03: No Transaction Safety for Submission Creation + Enqueue

**File:** `apps/api/src/routers/modules.ts:37-55` and `apps/api/src/routers/submissions.ts:24-43`

**Issue:** Submissions are created in the database (`submission.create`) and then enqueued to BullMQ (`submissionQueue.add`). If:
- Redis goes down between the two calls → a submission is persisted with `status: "pending"` but is never processed → **zombie submission**.
- The DB write succeeds but the enqueue throws → same zombie problem.
- The server crashes after the DB write but before the enqueue → same.

There is no cleanup mechanism or retry for orphaned pending submissions.

**Severity:** WARNING

**Fix:** Use Prisma's interactive transactions to write the submission AND an outbox record atomically, or use a scheduled job to detect and retry stuck pending submissions:

```typescript
await ctx.prisma.$transaction(async (tx) => {
  const submission = await tx.submission.create({
    data: { userId, moduleId: input.moduleId, code: input.code, status: "pending" },
  });

  // Write to outbox table
  await tx.submissionOutbox.create({
    data: { submissionId: submission.id, status: "pending" },
  });
});
```

---

### WR-04: No Dedup Check for Pending Submissions

**File:** `apps/api/src/routers/modules.ts:22-58` and `apps/api/src/routers/submissions.ts:6-50`

**Issue:** Users can submit multiple times for the same module with no check on whether there's already a pending (unscored) submission. This creates duplicate pending work for the worker, wasting API calls to the AI service for submissions that will be superseded.

**Severity:** WARNING

**Fix:** Check for existing pending submissions before creating a new one:

```typescript
const existing = await ctx.prisma.submission.findFirst({
  where: { userId: ctx.session.user.id, moduleId: input.moduleId, status: "pending" },
});
if (existing) {
  throw new TRPCError({ code: "CONFLICT", message: "You already have a pending submission for this module" });
}
```

---

### WR-05: Socket.io CORS Allow-Origin `"*"` (Inconsistent with Express CORS)

**File:** `apps/api/src/index.ts:142-143`

**Issue:** The Socket.io server allows all origins (`origin: "*"`), while the Express middleware on line 154 restricts to `http://localhost:3000`. This inconsistency means Socket.io can be accessed from any domain in production, enabling cross-origin WebSocket attacks. The Express CORS restriction provides no defense because Socket.io has its own CORS handling.

**Severity:** WARNING

**Fix:** Align Socket.io CORS with Express CORS:

```typescript
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  },
});
```

---

### WR-06: Duplicated IRS Calculation Logic

**Files:** `apps/api/src/services/irs-engine.ts:18-51` and `apps/api/src/services/submission-worker.ts:130-169`

**Issue:** The `calculateIRS` function in `irs-engine.ts` and `triggerIRSRecalculation` in `submission-worker.ts` contain nearly identical logic — both iterate scored submissions, parse feedback JSON, sum scores, and compute averages. Any change to the IRS formula must be made in two places, creating a maintenance risk.

**Severity:** WARNING

**Fix:** Consolidate into a single exported function:

```typescript
// In irs-engine.ts
export async function calculateIRS(prisma: PrismaClient, userId: string): Promise<IRSResult> { ... }

// In submission-worker.ts
import { calculateIRS } from "./irs-engine";
// ... use it directly, remove triggerIRSRecalculation
```

---

### WR-07: Session Token Stored in `localStorage` (XSS Vulnerability)

**Files:**
- `apps/web/src/stores/auth-store.ts:32,55,82,108,132`
- `apps/web/src/lib/trpc/provider.tsx:17-21`

**Issue:** The API session token is stored in `localStorage` under the key `unvibe_session`. This is accessible to any JavaScript running on the page. A single XSS vulnerability anywhere in the application (e.g., in a user-rendered component, third-party script, or compromised dependency) would leak the session token, allowing full account takeover.

**Severity:** WARNING

**Fix:** Use `httpOnly` cookies for session tokens instead of localStorage. The API should `Set-Cookie` on sign-in and read the cookie on subsequent requests:

```typescript
// In auth router signIn/signUp mutations, set a cookie:
// This requires the API to be on the same domain or use a proxy.
```

If same-domain cookies are not feasible, at minimum:
1. Set `SameSite=Strict` on the cookie
2. Apply Content Security Policy headers
3. Consider short-lived tokens with refresh rotation

---

### WR-08: No Input Length Validation on User Inputs

**Files:**
- `apps/web/src/app/auth/signin/page.tsx:70-78` — email and password inputs
- `apps/web/src/app/auth/signup/page.tsx:72-84` — name, email, password inputs
- `apps/web/src/components/features/annotation-editor.tsx:20` — annotation text

**Issue:** While the API validates Zod schemas, the frontend client-side inputs have no `maxLength` attribute. A user (or automated script) could submit extremely long strings, causing:
- Excessive memory consumption in the API
- Potential performance issues during JSON serialization/deserialization
- Large database storage

**Severity:** WARNING

**Fix:** Add `maxLength` to all input fields and enforce reasonable limits:

```tsx
<Input placeholder="email@company.com" type="email" maxLength={255} ... />
<Input placeholder="Password" type="password" maxLength={128} ... />
```

---

### WR-09: Hardcoded `"dark"` Class in Root Layout

**File:** `apps/web/src/app/layout.tsx:29`

**Issue:** `<html lang="en" className="dark">` forces dark mode on every page load, overriding the user's system preference and the theme store's persisted preference. Users who prefer light mode see a flash of dark content before the theme provider adjusts (if it does at all).

**Severity:** WARNING

**Fix:** Remove the hardcoded `dark` class and let the `ThemeProvider` handle it:

```tsx
<html lang="en" suppressHydrationWarning>
```

Then in the ThemeProvider, apply the class before first render using a script or inline logic.

---

### WR-10: N+1 Query for Leaderboard Scores (Duplicated Logic)

**Files:** `apps/api/src/routers/irs.ts:87-100` and `apps/api/src/routers/warRoom.ts:22-35`

**Issue:** The leaderboard query is duplicated in two routers (`irs.getLeaderboard` and `warRoom.getLeaderboard`) with slightly different `take` values (50 vs 20). Both queries join `IRSScore` with `User` to map user data. This is almost identical logic in two places.

**Severity:** WARNING

**Fix:** Extract into a shared service function:

```typescript
// apps/api/src/services/leaderboard.ts
export async function getLeaderboard(prisma: PrismaClient, take = 20) {
  const scores = await prisma.iRSScore.findMany({
    include: { user: { select: { name: true, image: true } } },
    orderBy: { score: "desc" },
    take,
  });
  return scores.map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    name: s.user.name ?? "Anonymous",
    avatar: s.user.image,
    score: s.score,
  }));
}
```

---

### WR-11: No Error Handling for Redundant `defendSession` Check

**File:** `apps/api/src/services/submission-worker.ts:183-189`

**Issue:** The `scheduleDefendSession` function checks for existing active defend sessions before creating a new one. However, if multiple submissions are processed concurrently for the same `(userId, moduleId)`, the `findFirst` → `create` sequence has a **race condition**. Two concurrent workers could both see no existing session and both create one, resulting in duplicate defend sessions.

**Severity:** WARNING

**Fix:** Use a unique constraint or `create` with `skipDuplicates`:

```prisma
model DefendSession {
  ...
  @@unique([userId, moduleId, status])
}
```

Or use a Prisma transaction with proper locking.

---

### WR-12: Redis URL Parsing Without Validation

**File:** `apps/api/src/index.ts:50-54`

**Issue:** The Redis URL parsing uses brittle string splitting:

```typescript
const connectionOpts = {
  host: redisUrl.split("://")[1]?.split(":")[0] || "localhost",
  port: parseInt(redisUrl.split(":")[2]) || 6379,
};
```

If `REDIS_URL` contains authentication (e.g., `redis://user:pass@host:6379`), or is a Unix socket path, or contains IPv6 addresses, the parsing breaks completely. The port extraction via index `[2]` is fragile — it assumes a specific URL format.

**Severity:** WARNING

**Fix:** Use `URL` constructor for robust parsing:

```typescript
function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port) || 6379,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}
```

---

## Info

### IN-01: Placeholder Hooks Return Non-Sensical Data

**File:** `apps/web/src/lib/trpc/hooks.ts:9-41`

**Issue:** All custom hooks (`useDashboardData`, `useTracksData`, `useModuleData`, `useWarRoomData`, `useProfileData`, `useBlindspotsData`) return `trpc.health.useQuery()`, which returns `{ status: "ok", timestamp: Date }` — completely unrelated to their names. Components that use these hooks would receive misleading data.

**Severity:** INFO

**Fix:** Either wire them to the correct tRPC endpoints or throw a clear error:

```typescript
export function useTracksData() {
  return trpc.tracks.getAll.useQuery();
}
```

---

### IN-02: IRS Engine Average Uses 0-100 Scale Twice

**File:** `apps/api/src/services/irs-engine.ts:41`

**Issue:** The IRS score is calculated as `Math.round((totalScore / scoredCount) * 100)`. If `parsed.overallScore` is already on a 0-100 scale (as returned by the AI service), the multiplication by 100 inflates the score to 0-10000 range. However, the UI interprets it as 0-100 (shown as "IRS 82" in the landing page). This means either:
1. The AI service returns 0-1 scores (making `* 100` correct), or
2. The scores are inflated 100× and displayed incorrectly.

The code in `irs.ts:56` does `Math.round(avg * 100)` but `irs-engine.ts:41` does `Math.round((totalScore / scoredCount) * 100)`. If `overallScore` is 0.82, these would produce 82 in both cases. But if it's 82, `irs-engine` would produce 8200. This inconsistency needs validation.

**Severity:** INFO

**Fix:** Document and enforce the expected scale of `overallScore` (0-1 or 0-100) and ensure all calculation points use consistent scaling.

---

### IN-03: `Record<string, unknown>` Type Safety Bypass

**File:** `apps/api/src/routers/submissions.ts:63`

**Issue:** The `where` filter uses `Record<string, unknown>`, which bypasses TypeScript's type checking for Prisma query parameters. A typo in the property name would not be caught at compile time:

```typescript
const where: Record<string, unknown> = { userId };
if (input?.moduleId) where.moduleId = input.moduleId;
```

**Severity:** INFO

**Fix:** Use Prisma's generated `SubmissionWhereInput` type:

```typescript
import type { Prisma } from "@prisma/client";
// ...
const where: Prisma.SubmissionWhereInput = { userId };
```

---

### IN-04: API `/health` Endpoint Duplicates tRPC Health

**File:** `apps/api/src/index.ts:123-124,172-174`

**Issue:** Two health check endpoints exist: a tRPC query (`router({ health: ... })`) and an Express GET `/health` route. Both return similar data. This duplication is unnecessary and creates inconsistency.

**Severity:** INFO

**Fix:** Remove the tRPC health endpoint and keep only the Express `/health` route (which works without tRPC client), or vice versa.

---

### IN-05: `IRSRadarChart` Always Receives Empty Data

**File:** `apps/web/src/components/features/irs-radar-chart.tsx:6`

**Issue:** The `IRSRadarChart` component is always rendered with `data={[]}` (empty array). The recharts RadarChart renders an empty chart with only grid lines. This is dead UI — it occupies screen space without providing any information.

```typescript
<IRSRadarChart data={[]} />
```

**Severity:** INFO

**Fix:** Either compute radar data from actual IRS dimension scores or hide the component until data is available.

---

### IN-06: Magic Number Constants Should Be Named

**Files:** Multiple

**Issue:** Several numeric values are used inline without named constants:

| Location | Value | Meaning |
|----------|-------|---------|
| `apps/api/src/routers/auth.ts:12` | `7 * 24 * 60 * 60 * 1000` | Session TTL (7 days) |
| `apps/api/src/services/submission-worker.ts:111` | `5` | Worker concurrency |
| `apps/api/src/services/ai-client.ts:115` | `10_000` | AI service timeout (ms) |
| `apps/api/src/services/ai-client.ts:116` | `2` | Max retries |
| `apps/api/src/routers/irs.ts:65` | `30` | Blindspot severity threshold |
| `apps/web/src/components/features/module-player.tsx:45` | `33, 66, 100` | Phase progress percentages |

**Severity:** INFO

**Fix:** Extract into named constants at the top of each file or in a shared config module.

---

### IN-07: Seed Data User Has No Password Hash

**File:** `apps/api/prisma/seed.ts:66-75`

**Issue:** The demo user `demo@unvibe.dev` is created without a `passwordHash` field. The comment says "password is 'demo1234' — bcrypt hash" but no hash is stored. This user cannot sign in via email/password — only OAuth. If the intent is to allow demo login with password, the hash must be included:

```typescript
create: {
  id: "user-demo-001",
  name: "Demo User",
  email: "demo@unvibe.dev",
  passwordHash: await bcrypt.hash("demo1234", 10),
},
```

**Severity:** INFO

**Fix:** Add the bcrypt hash to the seed data.

---

### IN-08: `getProgress` Fetches All Submissions Without Pagination

**File:** `apps/api/src/routers/tracks.ts:30-39`

**Issue:** The `getProgress` endpoint fetches **all** submissions for the current user without any limit. For users with thousands of submissions, this becomes an increasingly expensive query that returns rows just to count them. A `count` query with grouping would be far more efficient.

**Severity:** INFO

**Fix:**

```typescript
// Use aggregation instead of fetching all rows
const completedCount = await ctx.prisma.submission.count({
  where: {
    userId: ctx.session.user.id,
    status: { in: ["scored", "defended"] },
  },
});
// Then join with tracks/modules for progress
```

---

_Reviewed: 2026-07-02T16:00:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: deep_
