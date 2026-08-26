# UnVibe — Handover Orientation

**Read this file first.** It tells you what this project is, how it is shaped, what runs where, and which document to open next.

**Handover date:** August 2026
**Status:** The previous owner has abandoned the project and deleted all their API keys and deployments. **Every credential that ever existed for this project must be treated as compromised and rotated by you before going live.** See [`KNOWN-ISSUES-AND-HISTORY.md`](./KNOWN-ISSUES-AND-HISTORY.md) §5 before doing anything else.

---

## 1. What UnVibe is

UnVibe is an AI-powered learning platform for developers ("Stop vibing. Start understanding."). It trains developers to deeply understand code instead of just generating it, via a **Decode → Rebuild → Defend** loop:

1. **Decode** — analyze AI-generated production code, annotate it, pass a comprehension quiz.
2. **Rebuild** — rewrite the solution from memory without AI assistance.
3. **Defend** — explain and modify your code under Socratic questioning from an LLM.

Progress is measured by an **Irreplaceability Score (IRS)** that tracks comprehension depth versus AI dependency.

## 2. Architecture at a glance

There is exactly **one deployable application**: a Next.js app that serves *both* the UI and the API (tRPC mounted in-app). There is no separate backend anymore.

```text
                        ┌────────────────────────────────────────────────────────┐
                        │                    Vercel                              │
                        │        Project: un-vibe-web                            │
                        │   https://unvibe-omnikon.vercel.app                    │
                        │   Root Directory: apps/web (Next.js 14 App Router)     │
                        │                                                        │
  Browser ──HTTPS──────▶│  ┌──────────────────────────────────────────────────┐  │
                        │  │ Next.js app                                      │  │
                        │  │                                                  │  │
                        │  │ • Pages (/ , /auth/signin , /app/dashboard …)    │  │
                        │  │ • /api/auth/[...nextauth]   ← NextAuth v5 JWT    │  │
                        │  │      (GitHub + Google OAuth)                     │  │
                        │  │ • /api/auth/issue-link-token ← HMAC proof issuer │  │
                        │  │ • /api/trpc/*               ← tRPC fetch adapter │  │
                        │  │        └── src/server/routers/*                  │  │
                        │  │              └── src/server/services/*           │  │
                        │  │                    │            │                │  │
                        │  └────────────────────┼────────────┼────────────────┘  │
                        └───────────────────────┼────────────┼───────────────────┘
                                                │            │
                       Prisma 5.22 (SQL over TCP)           OpenAI SDK pointed at
                                                │            https://openrouter.ai/api/v1
                                                ▼                        ▼
                                   ┌──────────────────────┐   ┌─────────────────────┐
                                   │ Neon PostgreSQL       │   │ OpenRouter (LLM:    │
                                   │ (serverless Postgres) │   │ gemini-flash etc.)  │
                                   └──────────────────────┘   └─────────────────────┘

  Optional, self-hosted only: Judge0 code-execution sandbox (docker compose,
  http://localhost:2358), called by tRPC router `judge0.execute`.
```

Key consequence of this shape:

- **Auth is two-layered.** NextAuth (JWT session, GitHub/Google OAuth) proves identity; then the frontend exchanges an HMAC-signed proof for the app's own database-backed session (`unvibe_session_token` httpOnly cookie). Do not "simplify" one layer away — see [`KNOWN-ISSUES-AND-HISTORY.md`](./KNOWN-ISSUES-AND-HISTORY.md) §7.
- **No Redis, no Render, no Sentry, no separate Express API.** These were removed. The root `README.md` still describes the old architecture — **it is stale; do not trust its deployment/stack sections.**

## 3. Monorepo layout

Package manager: **pnpm@10.18.0**, orchestrator: **Turborepo 2** (`turbo.json`), workspaces per `pnpm-workspace.yaml`: `apps/*`, `packages/*`.

| Path | What it is | Status |
|------|------------|--------|
| `apps/web` | **The entire product.** Next.js 14.2.35 + next-auth 5.0.0-beta.25 + tRPC 10.45 + Prisma 5.22. Server code lives under `apps/web/src/server/**`. | ✅ Deployed |
| `packages/types` | Shared TypeScript types (`@unvibe/types`). Resolved **directly from source** (`main: ./src/index.ts`) — no build step needed. | ✅ Used |
| `apps/ai-service` | Legacy Python FastAPI service. Nothing calls it anymore — `apps/web/src/server/services/ai-client.ts` now calls OpenRouter directly (its header comment says so explicitly). Kept only as reference. | 🪦 Orphaned |
| `apps/api` | Old Express backend. Source was deleted; only empty `dist/` and `node_modules/` leftovers remain on disk locally. Do not resurrect. | 🪦 Deleted |
| `infra/docker-compose.yml` | Local stack definitions. Only the **judge0-\*** services are relevant today. The legacy `postgres`/`redis`/`api`/`ai-service` entries are stale (the `api` entry even builds from the deleted `apps/api/Dockerfile` — running the whole compose file will fail). | ⚠️ Partially stale |
| `.env.example` | Ground truth for every environment variable. Copy → `.env.local`. | ✅ Authoritative |
| `.neon` | One-line JSON with the previous owner's Neon project id (`hidden-boat-27453346`). Reference only — you cannot access their Neon account. | ℹ️ Reference |
| `.vercel/project.json`, `apps/web/.vercel/project.json` | Vercel link files pointing at project `un-vibe-web`, org/team `team_fxFYqIC2PQ24CUQF19kA3e6M`. | ℹ️ Reference |
| `README.md` (root) | **Stale.** Still advertises Render, Express API, Upstash Postgres/Redis, and the Python AI service — none of which exist anymore. | ⚠️ Stale |
| `.github/workflows/discord.yml` | Reusable-workflow call into `Demon-Die/.github` with `secrets: inherit`. Org-specific; likely useless/broken under new ownership. Harmless but pointless. | ⚠️ Review |

### Inside `apps/web/src` (the parts that matter)

```text
src/
├── auth.ts                          # NextAuth config: GitHub+Google providers,
│                                    #   custom sign-in page /auth/signin,
│                                    #   session callback exposes user id from JWT sub
├── app/
│   ├── auth/signin/page.tsx         # Custom sign-in (GitHub, Google, email/password)
│   ├── app/…                        # Authenticated area: dashboard, tracks, profile,
│   │                                #   blindspot-map, war-room
│   └── api/
│       ├── auth/[...nextauth]/route.ts     # NextAuth handlers (GET/POST)
│       ├── auth/issue-link-token/route.ts  # Signs 60-second HMAC proof w/ NEXTAUTH_SECRET
│       └── trpc/[trpc]/route.ts            # tRPC fetch adapter (maxDuration 60s)
├── server/
│   ├── router.ts                    # appRouter: health + auth/tracks/modules/
│   │                                #   submissions/irs/warRoom/profile/judge0
│   ├── trpc.ts                      # initTRPC, publicProcedure, protectedProcedure
│   ├── context.ts                   # CookieJar + DB-session resolution
│   │                                #   (cookie: unvibe_session_token, 7-day Max-Age in SECONDS)
│   ├── prisma.ts                    # PrismaClient singleton
│   ├── routers/*.ts                 # auth, tracks, modules, submissions, irs,
│   │                                #   warRoom, profile, judge0
│   └── services/                    # llm (OpenRouter client), ai-client, prompts,
│                                    #   grader, irs-engine, leaderboard, judge0-client
├── lib/trpc/client.ts               # Frontend tRPC client (same-origin /api/trpc)
└── stores/                          # Zustand stores incl. auth-store (calls tRPC auth.*)
```

## 4. What runs where

| Concern | Local development | Production |
|---------|-------------------|------------|
| Web app + API | `next dev` at `http://localhost:3000` (run via `pnpm dev` from repo root) | Vercel project **un-vibe-web** → https://unvibe-omnikon.vercel.app |
| Database | Neon PostgreSQL (your own project) over TCP 5432 | Same Neon project |
| OAuth providers | GitHub + Google apps configured with localhost callbacks | Same provider apps need production callback URLs registered too |
| LLM calls | OpenRouter API (needs `OPENROUTER_API_KEY`) | Same |
| Code execution (Judge0) | Optional local docker containers on port 2358 | Not deployed [UNVERIFIED — no hosted Judge0 exists anywhere in repo/config] |
| Realtime war-room messaging | Stubbed out (`warRoom.getMessages` returns `[]`; socket.io client points at dead `localhost:3001`) | Same stub |

## 5. Document index

| File | Read it when… |
|------|---------------|
| [`SETUP-FROM-ZERO.md`](./SETUP-FROM-ZERO.md) | You are provisioning everything from nothing: Neon, GitHub OAuth, Google OAuth, OpenRouter, optional extras, and getting `localhost:3000` working end-to-end. |
| [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md) | You need to know exactly which env vars exist, which the code actually reads, where they're read, and how to obtain values. |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | You are setting up or fixing the Vercel deployment (project settings, env vars, post-deploy checks, troubleshooting). |
| [`KNOWN-ISSUES-AND-HISTORY.md`](./KNOWN-ISSUES-AND-HISTORY.md) | Something breaks (redirect_uri_mismatch, CANCELED deploys, Configuration error), or before touching auth/session code. Contains the incident log from August 2026 and the security-fix rationale you must not regress. |

## 6. Start-here checklist

Do these in order. Each step links to details.

1. ☐ **Rotate everything** (before any deploy): Neon password, GitHub OAuth secret, Google OAuth secret, OpenRouter key, Resend key → [`KNOWN-ISSUES-AND-HISTORY.md` §5](./KNOWN-ISSUES-AND-HISTORY.md#5-mandatory-credential-rotation).
2. ☐ Install prerequisites: Node 20+, pnpm 10 (via corepack), git. Docker Desktop optional (Judge0 only).
3. ☐ Provision a Neon database (or take ownership of the existing project if the old owner grants access) → [`SETUP-FROM-ZERO.md` §2–3](./SETUP-FROM-ZERO.md).
4. ☐ Run migrations + seed against your `DATABASE_URL` → [`SETUP-FROM-ZERO.md` §3](./SETUP-FROM-ZERO.md).
5. ☐ Create/register OAuth apps (GitHub + Google) with **both** localhost and production callback URLs → [`SETUP-FROM-ZERO.md` §4–5](./SETUP-FROM-ZERO.md). Registering production callbacks early avoids the #1 past outage (see incident log §1).
6. ☐ Get an OpenRouter key → [`SETUP-FROM-ZERO.md` §6](./SETUP-FROM-ZERO.md).
7. ☐ Build local `.env.local` (+ a plain `.env` for Prisma commands — the distinction matters) → [`SETUP-FROM-ZERO.md` §8](./SETUP-FROM-ZERO.md) and [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md).
8. ☐ `pnpm install && pnpm dev` → verify `localhost:3000`, sign in with GitHub and Google locally.
9. ☐ Set up Vercel (import repo, Framework = Next.js, Root Directory = `apps/web`, no custom commands) → [`DEPLOYMENT.md`](./DEPLOYMENT.md).
10. ☐ Add production env vars, deploy, run the post-deploy verification checklist → [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

*Everything in these documents is verifiable either from repository files (paths cited inline) or from the August-2026 incident log recorded in `KNOWN-ISSUES-AND-HISTORY.md`. Claims that could not be grounded in either are explicitly marked `[UNVERIFIED]`.*
