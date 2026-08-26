# Setup From Zero

**Audience:** the new owner of UnVibe, starting with nothing but this repository and no access to any of the previous owner's accounts.

Every external service must be provisioned by you. This document walks each one in dependency order, then boots the app locally. Production deployment is covered separately in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

> **Golden rule while following this doc:** register **both** `http://localhost:3000/...` and `https://unvibe-omnikon.vercel.app/...` callback URLs in every OAuth console *now*, even if you only care about local dev today. The August-2026 incident log shows that forgetting production callbacks caused a full sign-in outage ([`KNOWN-ISSUES-AND-HISTORY.md` §1](./KNOWN-ISSUES-AND-HISTORY.md)).

---

## 0. Prerequisites

| Tool | Version | Why / install |
|------|---------|---------------|
| Node.js | **20 LTS or newer** | Required by Next.js 14 and Prisma 5. The repo's types target Node 20 (`apps/web/package.json`: `@types/node ^20`). |
| pnpm | **10.18.x** | Pinned in root `package.json` via `"packageManager": "pnpm@10.18.0"`. Enable with corepack (bundled with Node): `corepack enable` then `corepack prepare pnpm@10.18.0 --activate`. |
| Git | any recent | You already have the repo if you're reading this. |
| Docker Desktop | optional | Only needed if you want the Judge0 code-execution sandbox locally (§7.4). |

Verify on Windows PowerShell:

```powershell
node -v      # expect v20.x or v22.x
pnpm -v      # expect 10.18.x
```

---

## 1. Get the code

```powershell
git clone <YOUR-FORK-OR-REPO-URL> UnVibe
cd UnVibe
```

Do **not** copy `.env.local` from anywhere expecting it to work — all values inside are dead (revoked) and compromised. You will create fresh env files in §8.

---

## 2. Database — Neon PostgreSQL

The app uses serverless PostgreSQL hosted at [https://neon.tech](https://neon.tech). Schema, migrations, and seed live at `apps/web/prisma/` (schema.prisma + exactly **two** migration folders: `20260701040038_init`, `20260702113513_add_password_hash`).

You have two paths:

### Path A — Reuse the existing Neon project (only if the old owner grants you their account)

- Project id for reference: `hidden-boat-27453346` (from the repo's root `.neon` file).
- Have the old owner invite your account to the org/project in the Neon console, then rotate the database password immediately (see [`KNOWN-ISSUES-AND-HISTORY.md` §5](./KNOWN-ISSUES-AND-HISTORY.md)).
- Skip to §3.

### Path B — Create a brand-new Neon project (recommended; assume nothing of the old account)

1. Sign up / log in at **https://neon.tech**.
2. Console → **Create project** → name it (e.g. `unvibe`) → choose a region near your users → Postgres version 16 is fine → **Create**.
3. On the project Dashboard, open the **Connection Details** panel (or "Connect" button) and copy the connection string. It looks like:

   ```text
   postgresql://USER:PASSWORD@ep-XXXX-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

4. Note that Neon gives you **two host variants**:
   - **Pooled** (host contains `-pooler`): goes through PgBouncer. Use as `DATABASE_URL` for the running app.
   - **Direct** (no `-pooler`): plain endpoint. Prefer this for migrations if you hit issues (see §3 troubleshooting).

Keep both strings handy; you'll paste one into env files in §3 and §8.

---

## 3. Apply schema: migrate + seed

### 3.1 Where DATABASE_URL must live for Prisma commands

This trips people up, so read it once:

- The **Next.js app** reads the repo-root `.env.local` because `apps/web/next.config.mjs` explicitly loads it: `dotenv.config({ path: "../../.env.local" })`.
- **Prisma does not read `.env.local`.** The Prisma CLI and Prisma Client load only plain `.env` files — checked at `./.env` and `./prisma/.env` relative to where the command runs (Prisma ORM docs: "Managing environment variables"). Since `pnpm --filter web db:migrate` executes with its working directory set to `apps/web`, Prisma will find `apps/web/.env`.
- Do not create *both* `apps/web/.env` and `apps/web/prisma/.env` containing `DATABASE_URL` — Prisma errors on conflicting duplicates across those two locations.

So the working arrangement used by this repo is:

```powershell
# from repo root — creates both files; fill in real values afterwards
Copy-Item .env.example .env.local          # ← Next.js reads this (root)
Copy-Item .env.example apps\web\.env.local # ← Next.js native convention when run from apps/web
```

Then create a minimal `apps\web\.env` containing just the database line (create the file if missing):

```text
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
```

(Alternatively, skip the `.env` file and export it per-session instead: `$env:DATABASE_URL = "postgresql://..."` before running the db commands.)

### 3.2 Run the commands

```powershell
# from the repo root
pnpm install                # first time only; also triggers prisma generate (postinstall)

pnpm --filter web db:migrate   # = prisma migrate dev → applies apps/web/prisma/migrations/*
pnpm --filter web db:seed      # = tsx prisma/seed.ts
```

Expected output: `migrate dev` reports 2 migrations applied; seed prints `Seeding database...` then `Seeding complete.`

What the seed creates (`apps/web/prisma/seed.ts`):

- Demo user: **`demo@unvibe.dev`** / password **`demo1234`** (bcrypt-hashed). Useful for testing email/password sign-in.
- Three tracks with modules: *Frontend Systems* (published), *AI Workflows* (published), *Backend Foundations* (unpublished).

### 3.3 Verify

```powershell
npx prisma studio   # run from apps/web if prisma isn't found at root; opens http://localhost:5555
```

You should see tables: User, Account, Session, VerificationToken, Track, Module, Submission, DefendSession, WarRoom, IRSScore — with seeded rows.

### 3.4 Troubleshooting migrations

| Symptom | Cause / fix |
|---------|-------------|
| `Environment variable not found: DATABASE_URL` | Prisma didn't get an env source. Create `apps/web/.env` per §3.1 or `$env:DATABASE_URL="..."` first. |
| Timeouts / prepared-statement errors during `migrate dev` | You may be using the **pooled** (`-pooler`) host. Swap `DATABASE_URL` to Neon's **direct** (non-pooler) string for the migration, then switch back for runtime. |
| Connection refused / DNS error to port 5432 | See the network-filtering gotcha in [`KNOWN-ISSUES-AND-HISTORY.md` §6](./KNOWN-ISSUES-AND-HISTORY.md) — try another network, or test reachability with Neon's HTTP serverless driver (`@neondatabase/serverless`). Vercel↔Neon is unaffected. |

---

## 4. GitHub OAuth application

Two variants exist. Pick **one**; either works with the code unchanged (`apps/web/src/auth.ts` uses next-auth's generic GitHub provider).

### Variant A — Classic OAuth App (simplest)

1. Go to **https://github.com/settings/developers** → **OAuth Apps** → **New OAuth App** (or "Register a new application").
2. Fill in:
   - **Application name:** `UnVibe` (anything)
   - **Homepage URL:** `https://unvibe-omnikon.vercel.app`
   - **Authorization callback URL:** you need *both* production and localhost registered:
     ```text
     https://unvibe-omnikon.vercel.app/api/auth/callback/github
     http://localhost:3000/api/auth/callback/github
     ```
     Exact strings, **no trailing slash**, scheme included.
     > Historically classic OAuth Apps accepted only ONE callback URL. Per the incident log (Aug 2026), GitHub now supports up to 10 redirect URIs on these apps — add both lines. If your form still shows a single field, put the production URL there and handle localhost by temporarily swapping the value during local development.
3. **Register application** → you land on the app page. **Client ID** is displayed there — copy it (this becomes `GITHUB_CLIENT_ID`).
4. Click **Generate a new client secret**. The secret is shown **exactly once** — copy immediately (this becomes `GITHUB_CLIENT_SECRET`). If lost, generate a new one on the same page (old secret dies instantly).

### Variant B — GitHub App (IDs start with `Ov23li`)

If you prefer the newer GitHub Apps model (managed under **https://github.com/settings/apps** → **New GitHub App**):

- Callback URL field natively supports multiple URLs — add both strings above.
- After creation, generate a client secret under **General → Client secrets**.
- You do NOT need webhook, permissions, or "Request user authorization (OAuth) during installation" beyond defaults for sign-in; keep the app private/unlisted.
- The resulting Client ID (starting `Ov23li`) + client secret go into the same `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` variables.

> Identification tip from the incident log: IDs starting `Ov23li` indicate a GitHub App under `/settings/apps`; older numeric IDs (e.g. `Iv1.…` / hex) indicate a classic OAuth App under `/settings/developers`.

### What the code expects

`apps/web/src/auth.ts`:

```ts
GitHub({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
}),
```

Callback path served by the app: `/api/auth/callback/github` (NextAuth catch-all route at `src/app/api/auth/[...nextauth]/route.ts`). That is why the registered URLs end with exactly that path.

---

## 5. Google OAuth (Google Cloud Console)

Full walkthrough; the resulting client id/secret feed `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

1. Go to **https://console.cloud.google.com** → top bar project picker → **NEW PROJECT** → name `unvibe` → **Create**. Make sure the new project is selected in the picker afterwards.
2. Left burger menu → **APIs & Services** → **OAuth consent screen**:
   - Choose **External** user type → **Create**.
   - Fill required fields: App name `UnVibe`, user support email (yours), developer contact email (yours). Scopes: defaults (email/profile/openid) suffice. Save through each step.
   - **CRITICAL — Publishing status:** after saving, back on the consent screen page, click **PUBLISH APP** and confirm **In Production**. If left **Testing**, Google blocks every account except explicitly added test users with "access blocked" — this bit the previous owner (incident log §1).
3. **Credentials** (left sidebar under APIs & Services) → **+ CREATE CREDENTIALS** → **OAuth client ID**:
   - Application type: **Web application**, Name: `UnVibe web`.
   - **Authorized JavaScript origins** — add BOTH:
     ```text
     https://unvibe-omnikon.vercel.app
     http://localhost:3000
     ```
   - **Authorized redirect URIs** — add BOTH (exact paths, no trailing slash):
     ```text
     https://unvibe-omnikon.vercel.app/api/auth/callback/google
     http://localhost:3000/api/auth/callback/google
     ```
   - **Create**.
4. A dialog shows **Client ID** and **Client secret**. Copy both now. If you lose the secret later, the same row's pencil-edit page offers **Reset secret** (old one dies) — Google never re-displays a secret.

Mismatched origins/redirects produce Google's infamous `400: redirect_uri_mismatch` — see [`KNOWN-ISSUES-AND-HISTORY.md` §1](./KNOWN-ISSUES-AND-HISTORY.md) for how that played out here.

---

## 6. OpenRouter (LLM features)

Required for quiz generation and Defend sessions. The app calls OpenRouter with the OpenAI SDK pointed at `https://openrouter.ai/api/v1` (`apps/web/src/server/services/llm.ts`).

1. Create an account at **https://openrouter.ai** → go to **https://openrouter.ai/keys**.
2. **Create Key** → name e.g. `unvibe-prod` → copy the key (`sk-or-v1-…`). Shown once.
3. Put it into `OPENROUTER_API_KEY` (local env + Vercel later).
4. Optional but recommended: add a small amount of credits to your OpenRouter account — generation fails without balance [UNVERIFIED: exact free-tier behavior changes over time; check openrouter.ai docs].

Default model is `google/gemini-2.0-flash-001` (override with `LLM_MODEL`; see [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md)). Model pricing/availability lives at https://openrouter.ai/models.

---

## 7. Optional integrations

Honest status of each, verified against the codebase:

| Service | Consumed by code? | Verdict |
|---------|-------------------|---------|
| Cloudflare R2 (`R2_*` vars) | **No.** Zero references in `apps/web/src` (grep-verified); `.env.example` itself says "reserved". | Skip until a feature needs uploads. |
| Resend email (`RESEND_API_KEY`) | **No.** No references in code. | Skip. |
| PostHog analytics (`NEXT_PUBLIC_POSTHOG_KEY`) | **No.** Only listed in `turbo.json` env passthrough; no SDK installed. | Skip. |
| Judge0 (`JUDGE0_URL`) | **Yes — the only optional integration actually wired up**: tRPC router `judge0.execute` → `src/server/services/judge0-client.ts` (default `http://localhost:2358`). | Self-host only, see below. |

### 7.4 Running Judge0 locally (if you want `judge0.execute` to work)

Start **only** the judge0 services — running the whole compose file fails because it also builds the deleted `apps/api/Dockerfile`:

```powershell
docker compose -f infra/docker-compose.yml up -d judge0-db judge0-redis judge0-server judge0-worker
```

Judge0 UI/API then answers on http://localhost:2358. There is currently **no hosted/production Judge0** anywhere in the config — in production, calls to `judge0.execute` will fail unless you provision something and point `JUDGE0_URL` at it [UNVERIFIED whether any production Judge0 exists outside this repo].

---

## 8. Local development bootstrap

### 8.1 Environment files

From the repo root:

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.example apps\web\.env.local
```

Fill in `.env.local` (root):

```ini
DATABASE_URL="postgresql://<you>:<password>@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="<random 32+ chars>"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
OPENROUTER_API_KEY="sk-or-v1-..."
```

Generate the secret on Windows:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

And create `apps\web\.env` with just `DATABASE_URL` (for Prisma commands — see §3.1).

Both filenames match `.gitignore` patterns (`.env*`), so they stay local.

### 8.2 Install & run

```powershell
pnpm install          # workspace install; postinstall runs prisma generate
pnpm --filter web db:migrate    # if not done in §3
pnpm --filter web db:seed       # if not done in §3
pnpm dev              # turbo runs apps/web's `next dev`
```

Open **http://localhost:3000**.

### 8.3 What to expect at localhost:3000

- Landing page (marketing-style home for the Decode→Rebuild→Defend concept).
- Navigate to **/auth/signin**: a card with **Continue with GitHub**, **Continue with Google**, and an email/password form.
- Email/password quick test: `demo@unvibe.dev` / `demo1234` (seed user) → lands on `/app/dashboard`.
- OAuth quick tests: clicking GitHub/Google should redirect to the provider and back. If you get `redirect_uri_mismatch` (Google) or *"redirect_uri is not associated"* (GitHub), the localhost callbacks from §4–5 aren't registered correctly.
- After signing in, dashboard loads tracks via tRPC (`tracks.getAll`) from your seeded data.

### 8.4 Local verification endpoints

| GET | Expected |
|-----|----------|
| `http://localhost:3000/api/trpc/health` | JSON containing `"status":"ok"` plus a timestamp (tRPC envelope shape varies; look for the word `ok`) |
| `http://localhost:3000/api/auth/providers` | JSON listing `github` and `google` objects (empty `{}` means provider creds missing) |

### 8.5 Local troubleshooting quick hits

| Symptom | Likely cause |
|---------|--------------|
| `Configuration` error page on /auth/signin | Missing/wrong `NEXTAUTH_SECRET` or empty provider credentials — check `.env.local` actually loaded (restart `next dev` after edits) |
| Prisma can't connect locally, but Vercel↔Neon works | Network-level TCP 5432 filtering — see incident log §6 |
| AI features (quiz/defend) error out | `OPENROUTER_API_KEY` missing/empty or zero credits on OpenRouter |
| War-room realtime dead / socket errors to :3001 | Expected — realtime was removed with the old Express API; `warRoom.getMessages` returns `[]` stub |

---

## 9. Done? Proceed to deployment

Once local sign-in works for both providers, continue to [`DEPLOYMENT.md`](./DEPLOYMENT.md) for Vercel setup, production env vars, and post-deploy checks.
