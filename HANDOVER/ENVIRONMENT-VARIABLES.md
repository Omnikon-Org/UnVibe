# Environment Variables Reference

**Ground truth:** the repo-root [`.env.example`](../.env.example) plus actual `process.env` usage grepped across `apps/web/src` (file references cited per row). If a variable isn't on this page, the code doesn't read it.

> # ⚠️ THE ONE VARIABLE THAT BREAKS PRODUCTION SIGN-IN
>
> **`NEXTAUTH_URL` must equal your production domain in production** — e.g. `https://unvibe-omnikon.vercel.app` — **never `http://localhost:3000`.**
> NextAuth builds OAuth redirect URIs from this value; a localhost value deployed to Vercel makes GitHub reject callbacks ("redirect_uri is not associated with this application") and Google return `400 redirect_uri_mismatch` with `redirect_uri=http://localhost:3000/api/auth/callback/google`. This exact failure happened in August 2026 and took down production sign-in on both providers. Full story: [`KNOWN-ISSUES-AND-HISTORY.md` §1](./KNOWN-ISSUES-AND-HISTORY.md).
> Local value stays `http://localhost:3000`; set them separately per environment.

---

## Where to set what

| Environment | File / location |
|-------------|-----------------|
| Local app runtime | Repo-root `.env.local` (loaded explicitly by `apps/web/next.config.mjs`: `dotenv.config({ path: "../../.env.local" })`). Copy from `.env.example`. |
| Prisma CLI/Client (`db:migrate`, `db:seed`) | Plain `.env` file next to where commands run — i.e. `apps/web/.env`. Prisma does **not** read `.env.local` (Prisma docs: it checks `./.env` then `./prisma/.env`). |
| Production / Preview (Vercel) | Vercel Dashboard → project **un-vibe-web** → **Settings → Environment Variables**; or CLI `npx vercel env add <NAME>` from repo root after `npx vercel link` (verify the linked project first — see [`DEPLOYMENT.md`](./DEPLOYMENT.md)). |
| Turbo note | `turbo.json` lists several of these under `tasks.build.env` so they pass through to build tasks. If you add a *new* build-relevant var, add it there too. |

---

## Required — core (sign-in does not work without these)

| Name | Used by (verified reference) | How to obtain | Local value style | Production value style |
|------|------------------------------|---------------|-------------------|------------------------|
| `DATABASE_URL` | `apps/web/prisma/schema.prisma` (`url = env("DATABASE_URL")`); consumed by `src/server/prisma.ts` singleton | Neon console → Connection Details ([SETUP §2](./SETUP-FROM-ZERO.md)) | Pooled Neon string, `sslmode=require` | Same string (Vercel↔Neon over TCP works fine); rotate password during handover! |
| `NEXTAUTH_SECRET` | `apps/web/src/app/api/auth/issue-link-token/route.ts` (HMAC signing), `src/server/routers/auth.ts` (proof verification), and internally by next-auth v5 as session-secret fallback | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | random base64 string | A **different** random string. Must be present or you get the "Configuration" error page. |
| `NEXTAUTH_URL` | Read implicitly by next-auth v5 (`trustHost: true` is set in `src/auth.ts`, but an explicit URL wins and drives provider callback construction) | Your deployment URL | `http://localhost:3000` | `https://unvibe-omnikon.vercel.app` (**must match the deployed origin exactly** — see warning above) |
| `GITHUB_CLIENT_ID` | `src/auth.ts` line 17 | GitHub → https://github.com/settings/developers (classic OAuth App) or https://github.com/settings/apps (GitHub App, IDs starting `Ov23li`) — [SETUP §4](./SETUP-FROM-ZERO.md) | same client id as prod | same |
| `GITHUB_CLIENT_SECRET` | `src/auth.ts` line 18 | Generated once at app creation; regenerate if lost/exposed | secret | **New secret** (old one is compromised — incident log §5) |
| `GOOGLE_CLIENT_ID` | `src/auth.ts` line 21 | Google Cloud Console → APIs & Services → Credentials → OAuth client ID — [SETUP §5](./SETUP-FROM-ZERO.md) | same client id as prod | same |
| `GOOGLE_CLIENT_SECRET` | `src/auth.ts` line 22 | Shown once at client creation; reset via pencil-edit page if lost | secret | **New secret** (compromised — incident log §5) |

---

## Required for AI features (quiz generation, Defend sessions)

| Name | Used by | How to obtain | Local value style | Production value style |
|------|---------|---------------|-------------------|------------------------|
| `OPENROUTER_API_KEY` | `src/server/services/llm.ts` line 38 | https://openrouter.ai/keys → Create Key | `sk-or-v1-…` | **Fresh key** (previous one compromised); add credits to account |
| `LLM_MODEL` | `llm.ts` line 41 — default `google/gemini-2.0-flash-001` | Pick from https://openrouter.ai/models | optional override | optional override |
| `LLM_MAX_TOKENS` | `llm.ts` line 42 — default `4096` (parsed as int) | n/a | optional | optional |
| `OPENROUTER_SITE_URL` | `llm.ts` line 43 — sent as OpenRouter attribution header; default `https://github.com/unvibe` | n/a | your local URL | your production URL |
| `OPENROUTER_APP_NAME` | `llm.ts` line 44 — default `"UnVibe"` | n/a | `UnVibe` | `UnVibe` |

### Code-known but NOT in `.env.example`

| Name | Used by | Notes |
|------|---------|-------|
| `OPENROUTER_BASE_URL` | `llm.ts` line 40 — default `https://openrouter.ai/api/v1` | Override hook only (e.g. proxying/debugging). Leave unset unless you know why. |

---

## Conditionally required

| Name | Used by | When needed | Default if absent |
|------|---------|-------------|--------------------|
| `JUDGE0_URL` | `src/server/services/judge0-client.ts` line 5 | Only if anyone uses tRPC `judge0.execute` (code-run sandbox). Self-host via `docker compose -f infra/docker-compose.yml up -d judge0-db judge0-redis judge0-server judge0-worker` (judge0 services only!). | `http://localhost:2358` |
| `NODE_ENV` | `src/server/context.ts` lines 32/39 — adds `; Secure` to the session cookie in production | Set automatically by Next.js/Vercel — never set manually | `development` locally |

---

## Optional & currently unused by code (defined in `.env.example` only)

Verified by grep: **zero** references in `apps/web/src`. They exist purely as placeholders for future features. Safe to leave empty; safe to skip entirely.

| Name | Intended purpose (per `.env.example`) | Obtain from |
|------|----------------------------------------|-------------|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Cloudflare R2 storage, "reserved for snapshots/PDF uploads" | https://dash.cloudflare.com → R2 → Manage API tokens |
| `RESEND_API_KEY` | Transactional email | https://resend.com/api-keys |
| `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics | https://app.posthog.com |

---

## Dead / legacy names — do NOT set, do not be confused by them

| Name | Status | Evidence |
|------|--------|----------|
| `NEXT_PUBLIC_API_URL` | Legacy socket.io target for war-room realtime; the server it pointed at (old Express API) was deleted. Only consumer is `src/lib/socket/client.ts` which falls back to `http://localhost:3001` — nothing listens there. War-room messages are stubbed (`warRoom.getMessages` returns `[]`). Still listed in `turbo.json` env passthrough. | grep + `src/server/routers/warRoom.ts` comment |
| `REDIS_URL` | Old docker-compose/Express-era variable; not read anywhere in `apps/web/src` | grep |
| `AI_SERVICE_URL` | Old pointer to the orphaned Python `apps/ai-service`; appears only inside legacy entries of `infra/docker-compose.yml` | grep |
| `PORT` | Not referenced by any code; Next.js manages its own ports | grep |
| Anything Sentry-related | Sentry monitoring was removed entirely (deps/config/env). If you see `SENTRY_*` anywhere, it's residue — don't reintroduce. | Incident log |

---

## Quick copy: minimal production set for Vercel

```text
DATABASE_URL        = postgresql://...neon.tech/neondb?sslmode=require
NEXTAUTH_SECRET     = <fresh-random-base64>
NEXTAUTH_URL        = https://unvibe-omnikon.vercel.app
GITHUB_CLIENT_ID    = <from github.com/settings/developers>
GITHUB_CLIENT_SECRET= <freshly generated>
GOOGLE_CLIENT_ID    = <from console.cloud.google.com>
GOOGLE_CLIENT_SECRET= <freshly generated>
OPENROUTER_API_KEY  = sk-or-v1-<fresh key>
```

Everything else is optional until a feature consumes it.
