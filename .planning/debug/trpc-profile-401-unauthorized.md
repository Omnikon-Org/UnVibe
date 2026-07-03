---
status: investigating
trigger: "401 Unauthorized error on tRPC profile endpoints (profile.getProfile, profile.getStats)"
created: 2026-07-03T12:00:00.000Z
updated: 2026-07-03T12:00:00.000Z
---

## Current Focus

hypothesis: "The Next.js middleware only checks NextAuth sessions. Email/password users have no NextAuth session, so they get redirected from all /app/* routes. For OAuth users, the API session cookie isn't set until SessionSync completes, causing 401s on initial page load."
test: "Trace middleware logic and SessionSync timing to confirm both failure modes"
expecting: "Two distinct root causes: middleware blocking email users, and race condition for OAuth users"
next_action: "Analyze middleware.ts and session-sync.tsx code paths"

## Symptoms

expected: "tRPC profile.getProfile and profile.getStats requests should return user profile data with 200 status"
actual: "Requests return 401 Unauthorized (3 console occurrences per page load)"
errors: |
  http://localhost:3000/trpc/profile.getProfile,profile.getStats?batch=1&input=%7B%7D
  → 401 Unauthorized (3 occurrences in console)
reproduction: "Visit /app/dashboard or /app/profile while signed in (either email/password or OAuth)"
started: "Likely since dual auth system was introduced"

## Eliminated

- hypothesis: "Cookie not forwarded through Next.js rewrite"
  evidence: "Next.js rewrites forward cookies to external destinations by default in production and dev."
  timestamp: "2026-07-03T12:00:00.000Z"

## Evidence

- timestamp: "2026-07-03T12:00:00.000Z"
  checked: "middleware.ts"
  found: "Only checks req.auth (NextAuth JWT). Email/password users have no NextAuth session."
  implication: "Email/password users are blocked from all /app/* routes by middleware"

- timestamp: "2026-07-03T12:00:00.000Z"
  checked: "session-sync.tsx"
  found: "SessionSync fires linkOAuth in a useEffect (after render). Dashboard/profile pages fire tRPC queries immediately during render."
  implication: "OAuth users experience race condition — tRPC queries fire before API cookie is set"

- timestamp: "2026-07-03T12:00:00.000Z"
  checked: "dashboard/page.tsx, profile/page.tsx"
  found: "Both pages use generic 'Failed to load content' error handling. No 401-specific redirect."
  implication: "Users with expired/invalid sessions see generic error instead of being redirected to sign-in"

- timestamp: "2026-07-03T12:00:00.000Z"
  checked: "auth-store.ts signIn()"
  found: "Email sign-in calls API directly (not NextAuth). Sets unvibe_session_token cookie via Set-Cookie."
  implication: "Email users rely solely on API session — no NextAuth session is created"

- timestamp: "2026-07-03T12:00:00.000Z"
  checked: "next.config.mjs"
  found: "Rewrites proxy /trpc to localhost:3001. Uses external rewrite which forwards all headers including cookies."
  implication: "Cookie forwarding through proxy is not the issue"

## Resolution

root_cause: "Two failure modes: (1) Middleware blocks email/password users because it only checks NextAuth, not the API session cookie. (2) OAuth users experience a race condition — tRPC queries fire before SessionSync completes the linkOAuth mutation."
fix: ""
verification: ""
files_changed: []
