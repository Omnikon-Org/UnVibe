## Title

fix: address review feedback — params, theme flash, Monaco theme, auth race, socket cleanup, gradient tokens + merge upstream/main

---

## Summary

Six fixes addressing the merge review feedback, plus a merge of upstream/main (7 file conflicts resolved). All six fixes are preserved after the merge. The branch is up to date with `upstream/main`, no remaining conflicts.

---

## Must-fix (blocking)

### 1. `params` not awaited in ModulePage (Next.js 15 compat)

**Commit:** `9e47097` | **File:** `apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/page.tsx`

**Problem:** `ModulePage` was a Client Component destructuring `params` synchronously:
```tsx
export default function ModulePage({ params }: { params: { trackId: string; moduleId: string } }) {
```

In Next.js 15, `params` becomes a Promise. This code would break on upgrade.

**Fix:** Since we're on React 18 (`use()` not available), we can't use `use(params)` in a Client Component. Instead, the page was split:
- `page.tsx` → async Server Component that `await`s params and passes them as plain props
- `module-page-content.tsx` → new Client Component (`"use client"`) receiving `{ trackId, moduleId }` as regular props

This works identically on Next.js 14 today (awaiting a plain object resolves immediately) and will work on Next.js 15 after upgrade with zero changes.

**Scope:** Grep of the entire `apps/web/src/app/` tree confirmed this was the **only file** destructuring `params` or `searchParams` — no other fixes needed.

**Post-merge update:** After merging upstream/main, the inner Client Component was updated to use upstream's tRPC queries (`trpc.tracks.getById.useQuery`, `trpc.modules.getById.useQuery`) instead of the old mock data hooks, since upstream had already replaced the mock data layer.

---

### 2. Dark-mode flash on light-mode load

**Commit:** `6e0d392` | **File:** `apps/web/src/app/layout.tsx`

**Problem:** `<html>` had a hardcoded `className="dark"`. The `ThemeProvider` toggles the `dark` class via `useEffect` — which runs *after* hydration. A user with a saved light-mode preference would see a dark page flash before React corrected it.

**Root cause analysis:**
- Theme preference is persisted via Zustand store → `localStorage("unvibe-theme")` → values `"dark"` or `"light"`
- Zustand initialized on client only (hydration), so the server always rendered `className="dark"`
- No inline script existed to read the stored preference before first paint

**Fix (3-part):**

1. **Removed `className="dark"`** from `<html lang="en">` — the server no longer hardcodes dark mode
2. **Added `suppressHydrationWarning`** to `<html>` — silences the false-positive hydration mismatch warning. The warning would fire because our inline script (step 3) mutates the DOM before React hydrates, causing the server-rendered class and client class to differ. This is intentional and harmless — `suppressHydrationWarning` silences just that one attribute on `<html>`.
3. **Added blocking inline `<script>`** before `<body>` content:
   ```js
   (function(){
     try {
       var t = localStorage.getItem("unvibe-theme");
       if (t === "light") document.documentElement.classList.remove("dark");
       else document.documentElement.classList.add("dark");
     } catch(e) {}
   })()
   ```
   This runs synchronously before React hydrates, reads the persisted preference, and sets the correct class on `<html>` immediately — zero flash.

**What didn't change:** The existing `useEffect` in `ThemeProvider` still handles class toggling when the user changes theme after load. The inline script only covers the initial paint.

**Verification:** Hard-refresh the page in light mode — the page loads directly in light mode with no dark flash.

---

### 3. Monaco editor ignores theme setting

**Commit:** `4c8994c` | **File:** `apps/web/src/components/features/code-editor.tsx`

**Problem:** The Monaco editor had `theme="vs-dark"` hardcoded. Toggling the app to light mode left the code editor in dark mode — a visual inconsistency.

**Fix:**
```tsx
import { useUIStore } from "@/stores/ui-store";
// ...
const darkMode = useUIStore((state) => state.darkMode);
// ...
<Editor theme={darkMode ? "vs-dark" : "light"} ... />
```

Now the editor's theme tracks the app's theme toggle in real time.

**Post-merge formatting:** Upstream/main reformatted the component's function signature to multiline. Both changes are preserved in the merged result.

---

### 4. `asChild` + `onClick` race condition in auth flow

**Commit:** `4ac870f` + merged via `1269c6f` | **Files:** `apps/web/src/app/auth/signin/page.tsx`, `apps/web/src/app/auth/signup/page.tsx`

**Original problem:** Both auth pages used:
```tsx
<Button asChild onClick={signIn}>
  <Link href="/app/dashboard">Enter mock workspace</Link>
</Button>
```
With `asChild`, the Button renders as a `<Link>`. The `onClick` (calling `signIn()` from the mock auth store) could race with the Link's native navigation — `signIn` might not fire before the browser navigates.

**Fix (original):** Removed the `asChild`/`Link` wrapper. Used a plain `<Button>` with `onClick={() => { signIn(); router.push('/app/dashboard'); }}`. Added a TODO for when real NextAuth wiring replaces the mock.

**Post-merge resolution:** Upstream/main had already replaced both pages with real auth forms (email/password inputs, validation, loading state, error display, real `next-auth/react` `signIn` for OAuth). The upstream version naturally avoids the `asChild` race — it uses `onClick={handleSignIn}` on a plain `<Button>` with no Link wrapper. We accepted upstream's version in the merge. Our TODO was retired since real auth is already wired.

The merged result:
- Real OAuth buttons (`signIn("github")`, `signIn("google")` with `next-auth/react`)
- Real email/password form with validation (check `handleSignIn`/`handleSignUp`)
- Loading states with `LoadingPanel`
- Error messages for invalid credentials
- All `asChild`/Link patterns eliminated

---

## Minor (cleanup)

### 5. Dead socket wiring in war-room-live

**Commit:** `9aa842f` | **File:** `apps/web/src/components/features/war-room-live.tsx`

**Problem:** `useEffect` called `getSocket().connect()` and `socket.disconnect()` in cleanup, but no socket event listeners were ever registered. The only data coming into the component was from a `setInterval` pushing mock messages. The socket calls were dead code.

**Fix:**
- Removed `import { getSocket } from "@/lib/socket/client"` (eliminates an ESLint `no-unused-vars` warning)
- Removed `const socket = getSocket()` and `socket.connect()` from the effect body
- Removed `socket.disconnect()` from the cleanup function
- Left a `// TODO: wire real socket events once War Room backend lands` comment above the `setInterval` so the intent is clear when the backend arrives

**Post-merge update:** Accepted upstream's import path change (`@unvibe/types` instead of `@/lib/mock-data/types`). The socket removal and TODO are preserved.

---

### 6. Hardcoded gradient hex values in ThemeProvider

**Commit:** `f56b01d` | **Files:** `apps/web/src/app/globals.css`, `apps/web/src/components/app/theme-provider.tsx`

**Problem:** `ThemeProvider` contained raw hex values inline:
- Dark: `radial-gradient(125% 125% at 50% 100%, #000000 40%, #010133 100%)`
- Light: `radial-gradient(125% 125% at 50% 90%, #ffffff 40%, #ec4899 100%)`

These weren't tied to the design token system. If the palette changed, they'd need manual updates.

**Fix:**
- Added `--gradient-radial` to `:root` (light) and `.dark` (dark) in `globals.css`, alongside the existing CSS custom properties
- Simplified `ThemeProvider` to: `style={{ background: "var(--gradient-radial)" }}`
- The CSS variable resolves automatically based on the `.dark` class on `<html>` — no conditional logic needed in the component

---

## Merge Details

**Commit:** `1269c6f`

Merged `upstream/main` into `feat/frontend-app-shell` with **7 file conflicts**, all resolved manually:

| File | Resolution strategy |
|------|-------------------|
| `page.tsx` (module) | Keep our async Server wrapper, update inner component with upstream's tRPC |
| `signin/page.tsx` | Accept upstream (real auth form supersedes our mock fix) |
| `signup/page.tsx` | Accept upstream (real auth form supersedes our mock fix) |
| `layout.tsx` | Keep our flash-fix version (upstream still had old hardcoded `className="dark"`) |
| `theme-provider.tsx` | Keep our CSS-variable version (upstream still had old inline hexes) |
| `code-editor.tsx` | Merge: upstream multiline signature + our darkMode logic |
| `war-room-live.tsx` | Merge: upstream import path + our socket cleanup |

Also fixed 4 pre-existing build blockers found during merge verification (all from upstream's new code):
- Installed `dotenv` dependency (missing in `next.config.mjs`)
- Installed `bcryptjs` + `@types/bcryptjs` for upstream's new auth router (`api`)
- Ran `prisma generate` (stale client after schema changes)
- Built `@unvibe/types` (unbuilt after type additions)

---

## Verification

```bash
pnpm lint     # ✅ No ESLint warnings or errors
pnpm build    # ✅ Compiled successfully, all 13 pages generated
```

**Route table:**
```
Route (app)                                   Size
┌ ○ /                                         2.7 kB
├ ○ /app                                      138 B
├ ○ /app/blindspot-map                        1.76 kB
├ ○ /app/dashboard                            4.29 kB
├ ○ /app/profile                              2.22 kB
├ ○ /app/tracks                               1.7 kB
├ ƒ /app/tracks/[trackId]/modules/[moduleId]  11.5 kB
├ ○ /app/war-room                             3.49 kB
├ ○ /auth/signin                              2.71 kB
├ └ ○ /auth/signup                            2.79 kB
```

No regressions in route structure, page rendering, or type safety.

---

## How to review

Each of the 6 original fixes is in its own commit for focused review:

| Commit | Fix | Scope |
|--------|-----|-------|
| `9e47097` | Await params | 2 files (page.tsx + new module-page-content.tsx) |
| `6e0d392` | Dark flash | 1 file (layout.tsx) |
| `4c8994c` | Monaco theme | 1 file (code-editor.tsx) |
| `4ac870f` | Auth race | 2 files (signin + signup pages) |
| `9aa842f` | Socket cleanup | 1 file (war-room-live.tsx) |
| `f56b01d` | Gradient tokens | 2 files (globals.css + theme-provider.tsx) |

The merge commit `1269c6f` shows how each conflict was resolved.

The latest merge commit `5a7d39d` brings in upstream/main (71 commits) and adds the post-review UX improvements below.

---

## UI & UX Improvements (Post-Review)

### Loading State / Skeleton

- Added `SkeletonLoader` component (`apps/web/src/components/ui/skeleton-loader.tsx`)
  - Page-level variants: `dashboard`, `tracks`, `war-room`, `module`
  - Wraps the upstream skeleton primitives (`Skeleton`, `SkeletonCard`, `SkeletonStatCard`, `SkeletonList`) from `@/components/app/skeleton`
  - Proper `role="status"` and `aria-label` for accessibility
  - `sr-only` "Loading..." text for screen readers
- Replaced `LoadingPanel` with `SkeletonLoader` in:
  - `apps/web/src/app/app/tracks/page.tsx` → `variant="tracks"` (3-column card grid skeleton)
  - `apps/web/src/app/app/tracks/[trackId]/modules/[moduleId]/module-page-content.tsx` → `variant="module"` (player layout skeleton)
- Upstream-merged `loading.tsx` files cover the remaining pages via Next.js Suspense:
  - `dashboard/loading.tsx` → stat cards + content grid skeleton
  - `war-room/loading.tsx` → message area + leaderboard skeleton
  - `blindspot-map/loading.tsx`, `profile/loading.tsx`, module `loading.tsx`
- Visible during initial page load (tested on Slow 3G via DevTools throttle)

### Custom Scrollbar

- Added themed scrollbar CSS to `apps/web/src/app/globals.css` (outside `@layer` — required for `::-webkit-scrollbar` to work)
- Light mode: neutral gray track (`#f1f1f1`) + medium thumb (`#888`)
- Dark mode: `.dark ::-webkit-scrollbar-*` selectors auto-switch when `ThemeController` toggles the `.dark` class on `<html>`
- Hover state for both modes; no green, blue, or purple per brand constraint
- Smooth color transitions with theme toggle

### Logo & Favicon

- Generated techy geometric "UV" lettermark logo (`apps/web/public/logo.png`, 512×512)
  - Color palette: coral/rose (`#e05c5c`) + teal (`#2dd4bf`) — no green, blue, or purple
  - Hexagonal grid background pattern, circuit trace accents
  - Transparent background PNG
- Favicon copied to `apps/web/public/favicon.ico` (32×32)
- Updated `apps/web/src/app/layout.tsx` `metadata.icons`:
  ```tsx
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  }
  ```
  Uses Next.js App Router metadata API (cleaner than raw `<link>` tags, no hydration warnings)
- Visible in browser tabs and bookmarks; Apple touch icon for mobile home screen add

---

## Second Merge Details

**Commit:** `5a7d39d`

Merged `upstream/main` into `feat/frontend-app-shell` with **4 file conflicts**, all resolved:

| File | Resolution strategy |
|------|-------------------|
| `module/page.tsx` | Keep our async Server wrapper (Next.js 15 compat) |
| `globals.css` | Merge: keep `--gradient-radial` + upstream `--success`/`--warning` tokens |
| `layout.tsx` | Keep our flash-fix inline script + add `metadata.icons` for favicon |
| `theme-provider.tsx` | Keep our CSS-variable approach (`var(--gradient-radial)`) |
