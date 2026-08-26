# Known Issues & Incident History

**Period covered:** August 2026 (final month of the previous owner's tenure)
**Purpose:** explain what was going wrong at handover, what was already fixed, and — critically — which security fixes you must **not** regress.

---

## 1. `redirect_uri_mismatch` on BOTH OAuth providers (production sign-in fully broken)

**Symptom:**

- GitHub sign-in: *"redirect_uri is not associated with this application"*
- Google sign-in: `400: redirect_uri_mismatch` with `redirect_uri=http://localhost:3000/api/auth/callback/google`

**Cause — two problems stacked:**

- **(a) Wrong env var in production [FIXED].** The Vercel project had `NEXTAUTH_URL=http://localhost:3000` while deployed at the production domain. NextAuth constructs provider callback URLs from that value, so production told GitHub/Google "send users to localhost". Already corrected via Vercel CLI to `https://unvibe-omnikon.vercel.app` — **but an env-var change only takes effect after a redeploy**, so a redeploy was still required for it to bite.
- **(b) Provider consoles never configured [FIXED by registration].** Neither console had ever been given the production callbacks:

  - **GitHub OAuth App callback URLs** (exact strings, no trailing slash):
    ```text
    https://unvibe-omnikon.vercel.app/api/auth/callback/github
    http://localhost:3000/api/auth/callback/github
    ```
    Note on variants: classic OAuth Apps historically allowed one URL; per this incident log (Aug 2026), up to 10 redirect URIs are now supported on those apps. If the app's ID starts with **`Ov23li`**, it's actually a **GitHub App** managed under `github.com/settings/apps`, which natively supports multiple callback URLs.
  - **Google Cloud Console → APIs & Services → Credentials → (the OAuth client):**
    - Authorized JavaScript origins += `https://unvibe-omnikon.vercel.app` and `http://localhost:3000`
    - Authorized redirect URIs += `https://unvibe-omnikon.vercel.app/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`
    - Consent screen **must be Published to Production** — Testing mode blocks every account except allowlisted test users.

**Prevention:** whenever the deployment origin changes, update three places together: Vercel domain, `NEXTAUTH_URL` (+redeploy), and both provider consoles. See [`DEPLOYMENT.md` §5.2/§6](./DEPLOYMENT.md).

---

## 2. Git-push deployments repeatedly landing CANCELED

**Symptom:** pushes to the repo produced Vercel deployments in **CANCELED** state even when nothing superseded them.

**Root cause:** unresolved `[UNVERIFIED]`. Working hypothesis: team-level build-concurrency quirks after a duplicate project was deleted (see §4).

**Workarounds (both confirmed working):**

- Dashboard: latest deployment → **Redeploy** button.
- CLI from repo root: `npx vercel deploy --prod --yes`

**Prevention/mitigation:** treat CANCELED-on-push as noise; retry via either workaround. If it starts happening consistently after manual retries too, investigate team settings/billing concurrency limits.

---

## 3. Vercel project-settings gotcha (already applied — keep it)

The correct configuration, which cost debugging time to find:

| Setting | Value |
|---------|-------|
| Framework Preset | **Next.js** |
| Root Directory | **`apps/web`** |
| Install Command | default (**no custom command**) |

A custom install command such as `cd ../.. && pnpm install` **breaks builds**. With Root Directory = `apps/web`, Vercel auto-detects the pnpm workspace correctly.

⚠️ Residual landmine: `apps/web/vercel.json` in the repo still declares exactly such custom commands (`installCommand`, `buildCommand`, `outputDirectory`). If builds ever fail at install with a `cd ../..` error, delete those overrides from that file — don't fight them with more dashboard overrides.

---

## 4. Duplicate Vercel project confusion

There WAS a second project named **`unvibe-omnikon`** alongside the real one, **`un-vibe-web`**. The duplicate has been deleted.

**Residual risk for you:** CLI commands operate against whatever the local `.vercel/project.json` link points to. Before changing env vars or deploying via CLI, verify the link:

```powershell
npx vercel link        # watch which project it resolves to
Get-Content .vercel\project.json   # must say "projectName": "un-vibe-web"
```

---

## 5. MANDATORY credential rotation

> **Every credential that existed anywhere during this handover must be treated as COMPROMISED and rotated by whoever takes ownership.** The previous owner deliberately deleted their keys/deployments, but exposure happened during transfer regardless.

Known-exposed items and where each lives:

| Credential | Exposed via | Rotation procedure |
|------------|-------------|--------------------|
| Neon database password | handover chat / `.env.local` | Neon Console → project → Roles/Connection Details → reset password (or create new role), copy fresh connection string, update local + Vercel `DATABASE_URL` |
| GitHub OAuth client secret | handover chat | github.com/settings/developers (or /settings/apps) → your app → Generate new client secret → update `GITHUB_CLIENT_SECRET` everywhere |
| Google OAuth client secret | handover chat | console.cloud.google.com → APIs & Services → Credentials → client → Reset secret → update `GOOGLE_CLIENT_SECRET` |
| OpenRouter API key | handover chat / `.env.local` | openrouter.ai/keys → revoke old key, create new → update `OPENROUTER_API_KEY` |
| Resend API key | handover chat / `.env.local` | resend.com/api-keys → delete old, create new (code doesn't consume it yet, but rotate anyway since it leaked) |
| Anything else from repo history or chat (`NEXTAUTH_SECRET`, demo passwords…) | assume yes | generate fresh `NEXTAUTH_SECRET`; change the seeded demo password if you keep it |

Also remember git history may contain old secrets — rotating them (as above) neutralizes that risk; scrubbing history is optional extra credit.

---

## 6. Local network blocks direct TCP 5432 to Neon

Encountered on the previous owner's machine: local Prisma couldn't connect to Neon because direct TCP to port 5432 was blocked at DNS level (ISP/corporate filtering).

**Symptoms:** Prisma hangs/timeouts locally; the same `DATABASE_URL` works fine from other networks.

**Diagnosis/workarounds:**

- Test reachability with Neon's HTTP serverless driver (`@neondatabase/serverless`) which tunnels over HTTPS/WebSocket instead of raw TCP.
- Or just switch networks (hotspot etc.) for migration work.
- Production is unaffected: **Vercel↔Neon works fine** — this is purely a local-dev annoyance.

---

## 7. Security-fix history — do not regress these

Five real bugs were fixed shortly before handover. Each fix lives in specific code; the rationale is preserved below so nobody "simplifies" them away.

### 7.1 Empty-string user-id collision — every visitor shared one account

NextAuth's JWT holds `sub` = provider account id, but the default session object omitted it, so downstream code resolving the user got `""` — and every visitor collapsed into one identity. Fix: the `session` callback in `apps/web/src/auth.ts` now copies `token.sub` into `session.user.id` (the comment there documents this). If you remove that callback thinking it's boilerplate, you reintroduce account merging.

### 7.2 Optional HMAC proof on `linkOAuth` — unauthenticated account takeover

`tRPC auth.linkOAuth` mints a DB session for a submitted id/email. When the proof token was optional, anyone could POST any known email and get a valid session cookie for that account — full takeover. Fix: the proof is now mandatory and verified: `/api/auth/issue-link-token` signs `{sub, email, exp}` with HMAC-SHA256 over `NEXTAUTH_SECRET` (60-second expiry); `src/server/routers/auth.ts` validates signature (timing-safe compare), expiry, AND binds both `sub` and `email` to the submitted input so a proof for account A can't be replayed against B. Keep the proof required. Keep the binding check.

### 7.3 Session-cookie maxAge unit bug — cookies died in ~10 minutes

Express takes `maxAge` in milliseconds; the Set-Cookie header wants seconds. Porting the value verbatim made a 7-day session expire in ~10 minutes (7 days expressed as ms, read as s). Fix: `src/server/context.ts` defines `SESSION_TTL_SECONDS = 7 * 24 * 60 * 60` and interpolates it directly into the cookie string. If session lifetimes mysteriously shrink again, check units here first.

### 7.4 Raw Prisma User rows leaking `passwordHash`

Several responses returned whole Prisma `User` objects, including the bcrypt `passwordHash` column. Fix: `src/server/routers/auth.ts` defines a `PublicUser` shape and a `publicUser()` mapper; every return path uses it ("Never return raw Prisma User rows — they carry passwordHash", per the in-file comment). Any new router touching `user` should follow the same pattern — select/return explicit fields only.

### 7.5 Tokens stored in localStorage

Session tokens used to live in localStorage (readable by any XSS payload). Fix: tokens moved to the `unvibe_session_token` httpOnly cookie (`SameSite=Strict`, `Secure` in production, set via the CookieJar in `src/server/context.ts` and appended to tRPC responses by the route handler in `src/app/api/trpc/[trpc]/route.ts`). Don't move auth state back into JS-accessible storage; don't switch the cookie off httpOnly "for convenience".

---

## 8. Documentation drift warnings (minor, but they will confuse you)

- **Root `README.md` is stale:** still advertises Render hosting, a separate Express API, Upstash Postgres/Redis, and deploying the Python AI service. None of that exists. Trust [`HANDOVER/README.md`](./README.md) instead.
- **`infra/docker-compose.yml` legacy services:** only the `judge0-*` services are meaningful today; the `api` entry even builds from the deleted `apps/api/Dockerfile`, so running the entire compose file fails.
- **`.github/workflows/discord.yml`:** calls a reusable workflow from the `Demon-Die` org with `secrets: inherit` — org-specific residue, harmless but pointless under new ownership.
- **`NEXT_PUBLIC_API_URL` / socket.io war-room realtime:** the client (`src/lib/socket/client.ts`) targets a dead `localhost:3001`; war-room messages are stubbed to `[]` in `warRoom.getMessages` until realtime is intentionally rebuilt.
