# Deployment (Vercel)

Target platform is **Vercel**, project name **`un-vibe-web`**, production domain **https://unvibe-omnikon.vercel.app**. The app is a single Next.js deployment — UI and tRPC API ship together. There is no other hosting (Render was removed entirely).

Repo evidence of the previous setup:

- `.vercel/project.json` and `apps/web/.vercel/project.json` → `{"projectId":"prj_JgIzGS48tRam8LubgsvpvQrqBWCk","orgId":"team_fxFYqIC2PQ24CUQF19kA3e6M","projectName":"un-vibe-web"}`
- Team slug per handover notes: **yuvraj-sarathes-projects**
- ⚠️ Note: `.gitignore` excludes `.vercel`, so these link files are machine-local, not part of the repo history you clone.

---

## 1. Choose your path

### Path A — Take over the existing Vercel team (if the old owner transfers access)

1. Get invited to team **yuvraj-sarathes-projects** with at least project-admin rights.
2. Verify you're on the right project before touching anything:
   ```powershell
   npx vercel login
   npx vercel link        # confirm it resolves to "un-vibe-web"
   ```
   After linking, check `.vercel\project.json` says `"projectName": "un-vibe-web"`.
3. Rotate every env var value (incident log §5): Settings → Environment Variables → replace secrets one by one.
4. Skip to §3.

### Path B — Import the repo into a fresh Vercel project

1. Push the repo to a GitHub account/repo **you** control.
2. Go to **https://vercel.com/new** → select your repo → at the *Configure Project* step apply **exactly** the settings in §2 → **Deploy** (it will fail without env vars — that's fine, add them next per §2.2 then redeploy).
3. If the default `.vercel.app` domain differs from `unvibe-omnikon.vercel.app`, either rename the project to `un-vibe-web` (Settings → General → Project Name) or update `NEXTAUTH_URL` and both OAuth consoles to match whatever domain you actually get. **The three must always agree:** deployed origin = `NEXTAUTH_URL` = registered callback URLs.

> **Duplicate-project trap (real incident):** there was once a confusing second Vercel project named `unvibe-omnikon` alongside the real `un-vibe-web`; it has been deleted. Whenever operating via CLI, run `npx vercel link` and verify it points at **`un-vibe-web`** *before* changing env vars or deploying — otherwise you edit the wrong project's config. (`npx vercel project ls` lists what your token can see.)

---

## 2. Required project settings (do not skip)

These exact settings were hard-won during August 2026 debugging (incident log §3):

| Setting | Value | Where |
|---------|-------|-------|
| Framework Preset | **Next.js** | Settings → General → Build & Development Settings |
| Root Directory | **`apps/web`** | Settings → General → Root Directory (enable the override, type `apps/web`) |
| Install Command | **leave blank / default** | Same section |
| Build Command | **leave blank / default** | Same section |
| Output Directory | **leave blank / default** | Same section |

**Never add a custom Install Command like `cd ../.. && pnpm install`.** It breaks builds. With Root Directory set to `apps/web`, Vercel detects the pnpm workspace from the repo root lockfile and runs the right thing automatically. This exact command was tried and broke builds (incident log §3).

> **In-repo landmine:** `apps/web/vercel.json` still contains `"installCommand": "cd ../.. && pnpm install"`, `"buildCommand": "cd ../.. && npx turbo build --filter=web"` and an outputDirectory override. These contradict the working dashboard configuration described above. Whether they currently interfere depends on how Vercel merges file-level vs dashboard overrides for this setup `[UNVERIFIED]`. **If a build ever fails at the install step with a `cd ../..` error, delete those three keys from `apps/web/vercel.json`** (or the whole file) and redeploy. Do not re-add custom commands to compensate.

### 2.2 Environment variables

Add all of the following in **Settings → Environment Variables**, enabled for **Production** and **Preview** (values and acquisition steps in [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md)):

```text
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL              ← https://unvibe-omnikon.vercel.app  (NOT localhost!)
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENROUTER_API_KEY
```

Optional: `LLM_MODEL`, `LLM_MAX_TOKENS`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, `JUDGE0_URL`.

CLI alternative after `npx vercel link` (from repo root):

```powershell
npx vercel env add NEXTAUTH_URL production    # prompts for value
# …repeat per variable
```

Env var changes only take effect on the **next deployment** — changing `NEXTAUTH_URL` alone does nothing until you redeploy (this exact mistake caused incident log §1a).

---

## 3. Triggering deployments

- **Git integration:** pushing to the connected branch auto-deploys.
- **CLI manual deploy** (from repo root, after linking):
  ```powershell
  npx vercel deploy --prod --yes
  ```

If a git-push deployment shows **CANCELED** even though nothing superseded it — that's a known unresolved quirk, see §5.3 for workarounds that reliably work.

---

## 4. Post-deploy verification checklist

Run through ALL of these after every fresh environment-variable change:

1. ☐ **Providers endpoint** — open `https://unvibe-omnikon.vercel.app/api/auth/providers`
   Expect JSON containing **both** `github` and `google` objects with `signin`/`callback` URLs. `{}` means provider creds missing/not loaded.
2. ☐ **tRPC health** — open `https://unvibe-omnikon.vercel.app/api/trpc/health`
   Expect JSON containing `"status":"ok"` (plus timestamp; envelope formatting may vary by client). Defined in `apps/web/src/server/router.ts`.
3. ☐ **Real GitHub sign-in** — go to `/auth/signin` → Continue with GitHub → authorize → must land back on `/app/dashboard` signed-in.
4. ☐ **Real Google sign-in** — same via Continue with Google. Watch specifically for Google's `400 redirect_uri_mismatch` (means console registration ≠ deployed origin — see §5.2).
5. ☐ **Data round-trip** — dashboard should list seeded tracks (Frontend Systems / AI Workflows) fetched via `tracks.getAll` over tRPC, proving DATABASE_URL connectivity from Vercel.
6. ☐ **Session persists** — reload `/app/dashboard` while signed in; the `unvibe_session_token` httpOnly cookie (7-day Max-Age, `Secure` in prod — see `src/server/context.ts`) keeps you logged in.

---

## 5. Troubleshooting

### 5.1 NextAuth "Configuration" error page

**Meaning:** NextAuth can't build a valid config at runtime. Causes seen here:

- Missing `NEXTAUTH_SECRET` (or empty string),
- missing/empty `GITHUB_*` or `GOOGLE_*` credentials,
- invalid `NEXTAUTH_URL`.

Fix: compare against [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md), correct values in Vercel, **redeploy**.

### 5.2 `redirect_uri_mismatch` (Google 400 / GitHub "redirect_uri is not associated with this application")

The deployed app is sending a callback URL the provider doesn't have registered. Stacked root causes historically (full write-up in [`KNOWN-ISSUES-AND-HISTORY.md` §1](./KNOWN-ISSUES-AND-HISTORY.md)):

1. `NEXTAUTH_URL` wrong in production → fix env var → **redeploy**.
2. Provider consoles never had the production callbacks registered → register exactly:
   - GitHub: `https://unvibe-omnikon.vercel.app/api/auth/callback/github`
   - Google origins: `https://unvibe-omnikon.vercel.app`; redirects: `https://unvibe-omnikon.vercel.app/api/auth/callback/google`
   
   (Keep the localhost counterparts too.) Exact-string rules and console walkthroughs: [`SETUP-FROM-ZERO.md` §4–5](./SETUP-FROM-ZERO.md).

### 5.3 Git-push deployments stuck in CANCELED

Observed Aug 2026: pushes produced deployments in CANCELED state even when nothing superseded them. Root cause unresolved `[UNVERIFIED]` — suspected team-level build-concurrency quirks after the duplicate project deletion. **Workarounds that work:**

- Dashboard: open the latest deployment → **⋯ menu → Redeploy** (leave defaults), or
- CLI from repo root: `npx vercel deploy --prod --yes`

Both reliably produce a live production build. Treat CANCELED-on-push as noise unless it persists across manual retries.

### 5.4 Build fails mentioning `cd ../..`

You've tripped the `apps/web/vercel.json` landmine (§2 warning). Strip the custom commands from that file, keep dashboard settings at defaults, redeploy.

### 5.5 Runtime DB errors in production but not locally

Vercel↔Neon TCP works normally (verified during handover). Check `DATABASE_URL` actually exists in the Vercel project env (not just local), password rotated correctly (Neon role passwords are set at creation/reset — copy-paste the full new connection string rather than editing fragments), and that you didn't paste the direct URL where you wanted pooled or vice versa (either works at runtime; pooled is preferred).

---

## 6. Custom domains (future)

If you attach a real domain later:

1. Vercel → Settings → Domains → add domain, follow DNS instructions.
2. Update `NEXTAUTH_URL` to the new origin → redeploy.
3. Add matching entries in BOTH OAuth consoles (GitHub callback; Google origin+redirect) for the new domain.
4. Keep old URLs registered if you want the `.vercel.app` domain to keep working.

All three locations (deployment origin, `NEXTAUTH_URL`, provider consoles) must move together or sign-in breaks exactly as in §5.2.
