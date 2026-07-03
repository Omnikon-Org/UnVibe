---
phase: 0
slug: ui-design-contract
status: draft
shadcn_initialized: true
preset: shadcn-default-slate
created: 2026-07-03
---

# UnVibe — Complete UI Design Contract

> Visual and interaction contract for the UnVibe learning platform redesign.
> Supersedes all visual decisions in the existing codebase. Audit findings from UI-AUDIT.md are addressed as explicit contract items.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (default style, slate base) |
| Preset | `shadcn default` — baseColor: slate, cssVariables: true |
| Component library | Radix primitives via shadcn/ui |
| Icon library | lucide-react v0.363 |
| Font stack | Geist Sans (`--font-geist-sans`) + Geist Mono (`--font-geist-mono`) |
| Animation library | framer-motion v11 |
| Charting | recharts v2 (RadarChart only) |
| CSS framework | Tailwind CSS v3 + tailwindcss-animate |

### Design Philosophy (Binding)

1. **Product register** — Design serves the learning product. Every element must justify its existence through utility, not decoration.
2. **Anti-cream background** — No warm-tinted near-white backgrounds. The existing HSL background (210 25% 98%) is a cool off-white and is correct. Dark mode background (220 24% 6%) is a cool near-black.
3. **Layout principle** — Flexbox for 1D layouts, CSS Grid for 2D layouts. Never mix both on the same axis.
4. **Cards** — Only use cards when they are the best affordance for grouped content. Never nest cards. No ghost cards.
5. **Banned patterns** — No eyebrow badges, no gradient text, no glassmorphism as default, no side-stripe borders, no hero-metric-numbering (01/02/03), no `surface-grid` utility, no identical card grids repeated without content variance.
6. **Motion** — Intentional, ease-out curves. Respect `prefers-reduced-motion`. Framer-motion for layout transitions and micro-interactions. CSS transitions for hover/active states.
7. **Z-index scale** — Use a semantic z-index stack. Never use arbitrary z-index values.

### Z-Index Scale

| Layer | Value | Elements |
|-------|-------|----------|
| Base | 0 | Page content |
| Sticky | 10 | Sticky headers, sidebar |
| Dropdown | 20 | Menus, popovers, select |
| Mobile nav | 30 | Bottom mobile navigation |
| Modal backdrop | 40 | Overlay behind modals |
| Modal | 50 | Modal dialogs, drawers |
| Toast | 60 | Toast notifications |
| Tooltip | 70 | Tooltips |

---

## Spacing Scale

All values are multiples of 4. No exceptions.

| Token | Value | Usage |
|-------|-------|-------|
| 3xs | 2px | Compact icon gaps, border widths, focus rings |
| 2xs | 4px | Tight inline padding, checkbox/radio gaps |
| xs | 8px | Compact element spacing, stack gap (tight) |
| sm | 12px | Avatar/icon-to-text gaps, form field gaps |
| md | 16px | Default element spacing, button padding, card padding (horizontal) |
| lg | 24px | Section padding, card padding (vertical), grid gaps |
| xl | 32px | Layout gaps between major sections, sidebar padding |
| 2xl | 48px | Major section breaks, hero section bottom margin |
| 3xl | 64px | Page-level spacing, top padding for main content |

### Audit Compliance

- **Remove `text-[11px]`** — Mobile nav labels change from `text-[11px]` to `text-xs` (12px). Touch targets remain at minimum 44px height.
- **Replace `min-h-[400px]`** — ErrorFallback changes from `min-h-[400px]` to `min-h-[240px]` (fits spacing scale: 6 × 40px = 240px).
- **Standardize opacity levels** — Reduce from 5 background opacity variants to exactly 2:
  - `/60` for subtle surface differentiation (cards within sections, list items)
  - `/90` for container surfaces (sidebar, header, mobile nav)
  - Remove `/50`, `/80`, `/85`, `/95` variants entirely.

---

## Typography

### Font Stack

- **Geist Sans** — All body text, headings, labels, buttons, navigation
- **Geist Mono** — Code blocks, timestamps, email display, keyboard shortcuts, diff content, stats/numbers in data displays

### Size & Weight Scale

| Role | Size | Weight | Line Height | Letter Spacing | Font Family |
|------|------|--------|-------------|----------------|-------------|
| Hero heading | 5xl (48px) sm:6xl (60px) lg:7xl (72px) | 600 (semibold) | 1.1 | -0.03em | Geist Sans |
| Page title | 3xl (30px) sm:4xl (36px) | 600 (semibold) | 1.15 | -0.02em | Geist Sans |
| Section heading | 2xl (24px) | 600 (semibold) | 1.2 | -0.02em | Geist Sans |
| Card title | base (16px) | 600 (semibold) | 1.3 | -0.01em | Geist Sans |
| Body | sm (14px) | 400 (normal) | 1.6 | normal | Geist Sans |
| Body large | base (16px) | 400 (normal) | 1.6 | normal | Geist Sans |
| Label / Meta | xs (12px) | 500 (medium) | 1.4 | normal | Geist Sans |
| Caption / Timestamp | xs (12px) | 400 (normal) | 1.4 | normal | Geist Mono |
| Code inline | xs (12px) | 400 (normal) | 1.4 | normal | Geist Mono |
| Code block | xs (12px) sm:13px | 400 (normal) | 1.6 | normal | Geist Mono |
| Stat value | 4xl (36px) | 600 (semibold) | 1.0 | -0.02em | Geist Mono |
| Small stat | 2xl (24px) | 600 (semibold) | 1.0 | -0.02em | Geist Mono |

### Audit Compliance

- **Add explicit `font-normal`** — Body text must declare `font-normal` (400). Currently defaults to normal via Tailwind but is non-obvious. All `<p>` and description elements get explicit weight.
- **Remove `text-[11px]`** — Mobile nav labels use `text-xs` (12px) at weight 500.
- **Eyebrow badges eliminated** — Text role "eyebrow" does not exist. All heading context is provided via page titles, subheadings, or descriptive paragraphs.
- **Body line length** — All body text containers must constrain to 65-75ch max-width. Do not let body text span full viewport.
- **Heading tracking** — All headings use `tracking-tight` (already in codebase, maintain this).
- **No uppercase tracking on non-code elements** — Remove `uppercase tracking-[0.18em]` and `uppercase tracking-[0.22em]` patterns from all non-code UI text.

---

## Color

### Token System (HSL — Preserved)

The existing HSL token system is sound. No HSL values change. New tokens are added for semantic states.

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--background` | 210 25% 98% | 220 24% 6% | Page background, main surfaces |
| `--foreground` | 218 33% 10% | 213 31% 91% | Primary text |
| `--card` | 0 0% 100% | 220 20% 10% | Card backgrounds |
| `--card-foreground` | 218 33% 10% | 213 31% 91% | Text on cards |
| `--primary` | 188 91% 35% | 187 85% 52% | Interactive elements, active states, links |
| `--primary-foreground` | 190 90% 98% | 220 24% 6% | Text on primary |
| `--secondary` | 214 32% 91% | 218 18% 16% | Secondary surfaces, hover states |
| `--secondary-foreground` | 218 33% 12% | 213 31% 91% | Text on secondary |
| `--muted` | 215 28% 92% | 218 18% 14% | Subtle backgrounds, disabled surfaces |
| `--muted-foreground` | 216 14% 38% | 215 18% 63% | Secondary text, descriptions, placeholders |
| `--accent` | 41 96% 56% | 42 94% 58% | IRS badge, "Next" card accent, streak flame |
| `--accent-foreground` | 32 95% 12% | 220 24% 6% | Text on accent |
| `--destructive` | 0 84.2% 60.2% | 0 62.8% 30.6% | Error states, destructive actions, deletion |
| `--destructive-foreground` | 210 40% 98% | 210 40% 98% | Text on destructive |
| `--border` | 214 20% 84% | 218 16% 21% | Borders, dividers, outlines |
| `--input` | 214 20% 84% | 218 16% 21% | Input field borders |
| `--ring` | 188 91% 35% | 187 85% 52% | Focus rings |

### New Semantic Color Tokens

These are defined in `globals.css` as new CSS variables using the existing HSL format:

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--success` | 160 84% 39% | 160 84% 49% | Correct answer, quiz pass, submission pass |
| `--success-foreground` | 0 0% 100% | 220 24% 6% | Text on success |
| `--warning` | 38 92% 50% | 38 92% 60% | Warning states, blindspot severity >75% |
| `--warning-foreground` | 32 95% 12% | 220 24% 6% | Text on warning |
| `--info` | 207 90% 48% | 207 90% 58% | Information banners, tooltips |
| `--info-foreground` | 0 0% 100% | 220 24% 6% | Text on info |
| `--code-bg` | 220 24% 10% | 220 24% 3% | Code block background |
| `--diff-add` | 160 50% 95% | 160 50% 10% | Diff addition line background |
| `--diff-add-text` | 160 84% 30% | 160 84% 70% | Diff addition line text |
| `--diff-remove` | 0 50% 95% | 0 50% 10% | Diff removal line background |
| `--diff-remove-text` | 0 84% 50% | 0 84% 70% | Diff removal line text |

### 60/30/10 Distribution

| Proportion | Token | Elements |
|------------|-------|----------|
| **60% Dominant** | `--background` | Page backgrounds, main container backgrounds, app shell body |
| **30% Secondary** | `--card`, `--secondary` | Card surfaces, sidebar background, mobile nav, header, auth card |
| **10% Accent** | `--accent` | IRS badge background, streak flame icon, "Next" card highlight, accent-colored callout cards |

### Accent Reserved For (Explicit List)

Accent (amber `--accent`) is used ONLY on:
1. IRS badge background
2. Streak flame icon (`Flame` from lucide)
3. "Next" estimated time card accent border (dashboard)
4. Warning-severity blindspot badges (severity > 75%)
5. Accent-colored CTA badges on landing page

Accent is NOT used for:
- Interactive elements (use primary teal)
- Decorative borders (use border)
- Background patterns (use surface colors)
- Text highlights (use semantic tokens)

### Audit Compliance

- **Remove all hardcoded Tailwind colors** — Replace `text-amber-300`, `text-emerald-300`, `text-cyan-100`, `bg-black`, `bg-emerald-500/10`, `border-emerald-500/30`, `text-red-400`, `text-amber-400` with theme-aware CSS variable references:
  - `text-amber-300` → `hsl(var(--warning))` or `hsl(var(--accent))`
  - `text-emerald-300` → `hsl(var(--success))`
  - `text-cyan-100` → `hsl(var(--muted))` on code block background
  - `bg-black` → `var(--code-bg)` (new token)
  - `bg-emerald-500/10` → `var(--diff-add)`
  - `bg-red-500/10` → `var(--diff-remove)`
  - `border-emerald-500/30` → themed success border
  - `text-red-400` → `hsl(var(--destructive))`
  - `text-amber-400` (flame icon) → `hsl(var(--accent))`
- **Replace `text-muted-foreground/60`** — Use `hsl(var(--muted-foreground))` at full opacity. The existing muted-foreground already provides adequate contrast. The `/60` opacity modifier is removed entirely.
- **Remove `surface-grid` utility** — Delete from `globals.css`. Replace with solid `bg-muted/60` or solid `bg-background` on affected pages (landing, sign in, sign up).

---

## Copywriting Contract

### Audit Compliance: Replace Developer-Facing Copy

| Location | Old Copy | New Copy |
|----------|----------|----------|
| Landing CTA button | "Open mock dashboard" | "Open dashboard" |
| Dashboard description | "Mock data mirrors the future API shape while the backend catches up." | "Your training progress at a glance — stats, streaks, and leaderboard." |
| War Room description | "Socket.io client wiring is present with a mock live feed so the room works without backend events." | "Compete in live coding rooms. Defend your reasoning against peers." |
| LoadingPanel default | "Loading mock data" | "Loading..." |
| Module player "Add mock answer" button | "Add mock answer" | "Add response" |

### Primary CTAs by Surface

| Surface | Primary CTA | Copy |
|---------|-------------|------|
| Landing (unauthenticated) | Hero action | "Start training" |
| Landing (authenticated) | Hero action | "Open dashboard" |
| Landing secondary | Track browse | "Browse tracks" |
| Sign in | Submit | "Sign in" |
| Sign up | Submit | "Create account" |
| Dashboard | Action button | "Resume module" / "Browse tracks" |
| Module Decode phase | Phase transition | "Unlock rebuild" |
| Module Rebuild phase | Phase transition | "Start defend" |
| Module Rebuild phase | Code submission | "Submit rebuild" |
| Module Defend phase | Mock answer | "Add response" |
| War Room | Message send | "Send" |
| Auth OAuth | GitHub button | "Continue with GitHub" |
| Auth OAuth | Google button | "Continue with Google" |

### Empty States

| Surface | Heading | Body |
|---------|---------|------|
| Dashboard | "Complete your first module to see stats here" | — |
| Tracks | "No tracks available yet" | "Tracks are being prepared. Check back soon." |
| War Room | "No war room data available yet." | — |
| Blindspot Map | "No blindspots identified yet" | "Complete some modules to generate your blindspot map." |
| Profile | "Profile data is not available yet." | — |
| Module | "Module content is not available." | — |
| IRS Radar | "No radar data yet" | "Complete modules to see your skill breakdown" |

### Error States

| Surface | Heading | Body |
|---------|---------|------|
| All data pages | "Failed to load content" | "Please try refreshing the page. If the issue persists, contact support." |
| Error boundary | "Something went wrong" | `{error.message}` + "Try again" button |
| Sign in | — | "Could not sign in. Check your credentials." |
| Sign up | — | "Could not create account. The email may already be registered." |
| Code submission | — | "Something went wrong — try again." |

### Destructive Actions

| Action | Confirmation Required | Confirmation Copy |
|--------|-----------------------|-------------------|
| Sign out | Yes (dialog) | "Are you sure you want to sign out? You'll need to sign in again to continue training." |

Note: Sign out currently has no confirmation dialog. This is a mandatory addition. Use shadcn `AlertDialog` component with "Sign out" as confirm button and "Cancel" as dismiss.

---

## Component Inventory & Design Tokens

### Button (`@/components/ui/button`)

| Prop | Values | Design |
|------|--------|--------|
| Variant | `default`, `secondary`, `ghost`, `outline`, `destructive` | Existing implementation correct. No changes. |
| Size | `default` (h-10, 40px), `sm` (h-8, 32px), `lg` (h-11, 44px), `icon` (h-10 w-10) | Existing implementation correct. |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring` | Existing correct. |
| Disabled | `disabled:pointer-events-none disabled:opacity-50` | Existing correct. |
| Transitions | `transition-colors` on hover | Existing correct. Keep. |

### Badge (`@/components/ui/badge`)

| Variant | Current (Hardcoded) | Replacement |
|---------|---------------------|-------------|
| `success` | `border-emerald-500/30 bg-emerald-500/10 text-emerald-400` | `border-success/30 bg-success/10 text-success` |
| `warning` | `border-amber-500/30 bg-amber-500/10 text-amber-300` | `border-warning/30 bg-warning/10 text-warning` |
| `destructive` | `border-red-500/30 bg-red-500/10 text-red-400` | `border-destructive/30 bg-destructive/10 text-destructive` |

All other badge variants (`default`, `secondary`, `outline`) remain unchanged — they already use theme tokens.

### Card (`@/components/ui/card`)

| Element | Classes | Notes |
|---------|---------|-------|
| Card | `rounded-lg border border-border bg-card text-card-foreground shadow-sm` | No changes. Correct as-is. |
| CardHeader | `flex flex-col gap-1.5 p-5` | No changes. |
| CardTitle | `text-base font-semibold leading-none tracking-tight` | No changes. |
| CardDescription | `text-sm text-muted-foreground` | No changes. |
| CardContent | `p-5 pt-0` | No changes. |

### Progress (`@/components/ui/progress`)

No changes. Existing implementation uses theme tokens correctly.

### Input / Textarea (`@/components/ui/input`, `textarea`)

No changes. Existing implementation uses theme tokens correctly.

---

## Surface Specifications

### 1. Landing / Marketing Page (`/`)

#### Layout
- **Structure:** Full-viewport sections stacked vertically. No page header component.
- **Hero area:** `min-h-screen` with centered content. 2-column grid at `lg` breakpoint: `grid-cols-[1fr_520px]`.
- **Feature cards:** 3-column grid at `md` breakpoint, single column on mobile.
- **Footer:** Full-width border-top bar, `max-w-7xl` inner container.
- **Content max-width:** `max-w-7xl` (1280px) centered with `mx-auto`.
- **Mobile padding:** `px-6` sides, `py-5` vertical for nav, `px-6` for content sections.

#### Changes from Current
1. **Remove `surface-grid`** from hero section → replace with solid `bg-background` (light) or `bg-background` (dark). Subtle gradient backdrop from ThemeProvider remains.
2. **Remove uppercase tracking eyebrow** — The `Badge variant="outline"` showing "AI learning loop for builders" stays but loses the uppercase tracking pattern. Change to a simple `rounded-full border-primary/30 bg-primary/10 text-primary text-xs font-medium` badge.
3. **Replace CTA copy** — "Open mock dashboard" → "Open dashboard"
4. **Remove numbered markers** — Remove `0{index + 1}` (01, 02, 03) from sample module card signal items.
5. **Remove hardcoded code block colors** — Replace `bg-black` with `bg-[var(--code-bg)]`, `text-cyan-100` with `text-muted-foreground` (or themed foreground), `text-amber-300` with `text-accent`, `text-emerald-300` with `text-success`.
6. **Fix sample module label** — Replace `font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground` with `text-xs font-medium text-muted-foreground` (remove uppercase, tracking, mono).

#### Typography Map
| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Logo text | sm (14px) | 600 | foreground |
| Nav "Sign in" link | sm (14px) | 400 | muted-foreground → foreground on hover |
| Hero badge | xs (12px) | 500 | primary |
| Hero heading | 5xl→6xl→7xl | 600 | foreground |
| Hero subtitle | lg (18px) | 400 | muted-foreground |
| Feature card title | base (16px) | 600 | foreground |
| Feature card copy | sm (14px) | 400 | muted-foreground |
| Sample module label | xs (12px) | 500 | muted-foreground |
| Sample module title | base (16px) | 600 | foreground |
| Sample signal label | sm (14px) | 500 | foreground |
| Sample signal value | sm (14px) | 400 | muted-foreground |
| Code block | xs (12px) | 400 | Geist Mono |
| Footer text | xs (12px) | 400 | muted-foreground |

#### Interaction States
| Element | Default | Hover | Active/Focus |
|---------|---------|-------|-------------|
| Nav "Sign in" | text-muted-foreground | text-foreground | — |
| "Start training" button | bg-primary text-primary-foreground | bg-primary/90 | ring-2 ring-ring |
| "Browse tracks" button | bg-secondary text-secondary-foreground | bg-secondary/80 | ring-2 ring-ring |
| Feature card | border-border | border-primary/40 | — |
| Sample module signal row | border-border bg-background/70 | border-primary/60 | — |
| Footer links | text-muted-foreground | text-foreground | — |

#### Motion
- **Hero content entrance:** Framer-motion `fadeInUp` — opacity 0 → 1, y: 20 → 0, duration 0.6s, ease-out, stagger children 0.1s.
- **Feature cards entrance:** Framer-motion `staggerFadeIn` — each card fades in sequentially from bottom, duration 0.4s each, stagger 0.15s.
- **Sample module card entrance:** Framer-motion `scaleIn` — opacity 0 → 1, scale 0.95 → 1, duration 0.5s, ease-out, delay 0.3s.
- **No animation on reduced-motion.** Wrap all framer-motion in:
  ```tsx
  import { useReducedMotion } from "framer-motion";
  const prefersReducedMotion = useReducedMotion();
  const animationProps = prefersReducedMotion ? {} : { ... };
  ```

#### Empty/Loading/Error
- **Loading:** Static page shell renders immediately. Content areas show skeleton blocks (hero skeleton, feature card skeletons).
- **Error:** Full-page error fallback using ErrorFallback component with "Try again" button.
- **Empty:** Not applicable (static marketing page with no data dependencies).

---

### 2. App Shell

#### Layout
- **Desktop (lg+):** Fixed sidebar (w-64, 264px) on left. Sticky header (h-16, 64px) at top. Main content area with left margin `lg:pl-64`. Footer below main content, also `lg:ml-64`.
- **Mobile (< lg):** Full-width header. Bottom navigation bar (fixed, h-16). Main content with bottom padding `pb-24` to clear nav. Hidden sidebar, hidden footer.
- **Content width:** `max-w-7xl mx-auto` constrained within main area.
- **Header:** Sticky at top, `z-10` (sticky layer), full-width, horizontally contains: logo (mobile), email display (desktop), theme toggle, user info, sign out button.

#### Changes from Current
1. **Remove `text-[11px]` on mobile nav** → `text-xs font-medium`.
2. **Standardize backdrop-blur** — Keep backdrop-blur ONLY on:
   - Header: `bg-background/90 backdrop-blur` (change from `/85` to `/90`)
   - Sidebar: `bg-card` (remove backdrop-blur entirely — solid card color is cleaner)
   - Mobile nav: `bg-card/90 backdrop-blur` (change from `/95` to `/90`)
3. **Remove uppercase tracking on email** — Replace `font-mono text-xs uppercase tracking-[0.22em]` with `text-xs text-muted-foreground` (still Geist Mono for email, no uppercase, no tracking).
4. **Add sign-out confirmation** — Replace direct `handleSignOut()` call with AlertDialog. Must confirm before signing out.
5. **Replace "training console" label** — Sidebar subtitle changes from "training console" to just empty or removed (it adds no value). The sidebar title "UnVibe" is sufficient.

#### Navigation Items (Unchanged)
| Icon | Label | Path | Active State |
|------|-------|------|-------------|
| LayoutDashboard | Dashboard | /app/dashboard | bg-primary/10 text-primary |
| Route | Tracks | /app/tracks | bg-primary/10 text-primary |
| RadioTower | War Room | /app/war-room | bg-primary/10 text-primary |
| Map | Blindspots | /app/blindspot-map | bg-primary/10 text-primary |
| UserRound | Profile | /app/profile | bg-primary/10 text-primary |

#### Component States
| Element | Default | Hover | Active | Current (mobile nav) |
|---------|---------|-------|--------|---------------------|
| Sidebar nav link | text-muted-foreground | bg-muted text-foreground | bg-primary/10 text-primary | — |
| Mobile nav link | text-muted-foreground | — | bg-primary/10 text-primary | same as desktop |
| Sign out button | variant="outline" size="sm" | hover:bg-muted | — | — |

#### Motion
- **Sidebar:** No entrance animation (persistent on desktop).
- **Mobile nav:** Slide-up entrance on route change not needed (persistent).
- **Page transitions:** Main content area uses framer-motion `AnimatePresence` with keyed route wrapper for fade transition (opacity 0 → 1, duration 0.2s).

#### Empty/Loading/Error
- **Loading:** App shell renders immediately with sidebar/header/mobile nav skeleton. Child page handles its own loading state.
- **Error:** Error boundary at `app/layout.tsx` level catches shell-level errors.
- **Empty:** Not applicable (shell always renders).

---

### 3. Dashboard

#### Layout
- **Page header:** `PageHeader` without eyebrow. Title "Training status" with description. Action button in header row (right-aligned).
- **Stat cards:** 3-column grid (`sm:grid-cols-3`), each card is `Card` with `CardHeader` + `CardContent`. The third card "Next" uses `border-accent/40 bg-accent/[0.03]` for accent highlight.
- **Track progress + Streak:** 2-column grid at `lg` breakpoint (`lg:grid-cols-[1fr_360px]`).
- **Radar + Leaderboard:** 2-column grid at `lg` breakpoint (`lg:grid-cols-2`).

#### Changes from Current
1. **Remove eyebrow badge** from PageHeader. Title "Training status" with description only.
2. **Replace developer-facing description** — Change from "Mock data mirrors..." to "Your training progress at a glance — stats, streaks, and leaderboard."
3. **Remove `text-amber-400`** from StreakTracker flame icon → use `text-accent` (which maps to `hsl(var(--accent))`).
4. **Remove hardcoded placeholder data** — Wire real data to `IRSRadarChart` and `Leaderboard` components. The empty `data={[]}` must be replaced with actual tRPC query results.
5. **Use Suspense boundaries** — Replace aggregate loading (all 4 queries must complete) with individual Suspense boundaries for stat cards, track progress, radar, and leaderboard sections.

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Page title | 3xl→4xl | 600 | Geist Sans |
| Description | sm (14px) | 400 | Geist Sans |
| Stat card title | base (16px) | 600 | Geist Sans |
| Stat value | 3xl (30px) | 600 | Geist Mono |
| Stat label | sm (14px) | 400 | Geist Sans |
| Track title | base (16px) | 600 | Geist Sans |
| Module link | sm (14px) | 500 | Geist Sans |
| Radar label | xs (12px) | 500 | Geist Sans |
| Leaderboard entry name | sm (14px) | 500 | Geist Sans |
| Leaderboard rank | sm (14px) | 400 | Geist Mono |

#### Motion
- **Stat cards:** Framer-motion `staggerFadeIn` on mount — each card fades in with 0.1s stagger delay.
- **Progress bar:** CSS transition width changes with `transition-all duration-500 ease-out`.
- **Section entrance:** Each grid section fades in with 0.2s delay between sections.

#### Empty/Loading/Error
- **Loading:** 3 `SkeletonStatCard` components in grid, followed by `SkeletonCard` for track/streak, then 2 more `SkeletonCard` for radar/leaderboard. Add `role="status"` and `sr-only` "Loading dashboard".
- **Error:** Aggregate error state for all 4 queries. Use Suspense boundaries to isolate section failures.
- **Empty:** If no profile data exists (new user), show centered card: "Complete your first module to see stats here" with "Browse tracks" button.

---

### 4. Tracks Page

#### Layout
- **Page header:** Title "Choose a training path" with description "Select a track to begin training with real modules." — No eyebrow.
- **Track cards:** 3-column grid at `lg` breakpoint (`lg:grid-cols-3`). Each track is a `Card` with `CardHeader` + `CardContent`.
- **Module list:** Within each track card, `space-y-2` list of module links.

#### Changes from Current
1. **Remove eyebrow badge** from PageHeader.
2. **Remove `bg-background/60`** from module link items → use `bg-muted` instead (consistent solid background).
3. **Remove hardcoded `text-xs text-muted-foreground` for module count** — keep this pattern, it's fine as-is.

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Page title | 3xl→4xl | 600 | Geist Sans |
| Description | sm (14px) | 400 | Geist Sans |
| Track card title | base (16px) | 600 | Geist Sans |
| Track description | sm (14px) | 400 | Geist Sans |
| Module count label | xs (12px) | 400 | Geist Sans |
| Module link text | sm (14px) | 500 | Geist Sans |

#### Motion
- **Track cards:** Staggered fade-in on mount. 0.15s stagger, 0.4s duration, ease-out.
- **Module links:** No individual animation (too many elements).

#### Empty/Loading/Error
- **Loading:** `LoadingPanel` with `role="status"`.
- **Error:** ErrorFallback at page level.
- **Empty:** Centered card: "No tracks available yet" + "Tracks are being prepared. Check back soon."

---

### 5. War Room

#### Layout
- **Page header:** Title = room name, description = "Compete in live coding rooms. Defend your reasoning against peers." — No eyebrow.
- **Content grid:** 2-column at `lg` (`lg:grid-cols-[1fr_360px]`). Left = room feed card, right = leaderboard.
- **Feed card:** Contains scrollable message list (h-[520px] overflow-y-auto) + input bar at bottom.
- **Message items:** `rounded-md border border-border bg-card p-3` with author/timestamp header row and body text.

#### Changes from Current
1. **Remove eyebrow badge** from PageHeader.
2. **Replace developer-facing description** — Change from "Socket.io client wiring..." to "Compete in live coding rooms. Defend your reasoning against peers."
3. **Replace `bg-background/60`** on feed container → use `bg-muted` (solid, consistent).
4. **Replace `bg-card/95`** → use `bg-card` (remove opacity).

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Page title | 3xl→4xl | 600 | Geist Sans |
| Description | sm (14px) | 400 | Geist Sans |
| Section heading | base (16px) | 600 | Geist Sans |
| Message author | xs (12px) | 500 | Geist Sans |
| Message timestamp | xs (12px) | 400 | Geist Mono |
| Message body | sm (14px) | 400 | Geist Sans |
| "Live" badge | xs (12px) | 500 | Geist Sans |

#### Interaction States
| Element | Default | Hover | Focus |
|---------|---------|-------|-------|
| Send button | bg-primary | bg-primary/90 | ring-2 ring-ring |
| Message input | border-border | border-primary/60 | ring-2 ring-ring |

#### Motion
- **New messages:** Framer-motion `AnimatePresence` with `initial={{ opacity: 0, y: -10 }}` and `exit={{ opacity: 0 }}`. Duration 0.2s.
- **Send button:** No entrance animation (always visible).

#### Empty/Loading/Error
- **Loading:** SkeletonCard for feed area + SkeletonCard for leaderboard.
- **Error:** Aggregate error state for room + leaderboard queries.
- **Empty:** "No war room data available yet." in centered Card.

---

### 6. Blindspot Map

#### Layout
- **Page header:** Title "Weak concepts by evidence" with description "A compact view of concepts that need another decode, rebuild, or defend pass." — No eyebrow.
- **Content:** Vertical stack (`.grid gap-4`) of blindspot cards.
- **Each card:** Card component with CardHeader (title + severity badge) and CardContent (Progress bar + 2-column evidence/action grid).

#### Changes from Current
1. **Remove eyebrow badge** from PageHeader.
2. **Replace uppercase tracking labels** — "EVIDENCE" and "NEXT ACTION" labels change from `text-xs uppercase tracking-[0.18em]` to `text-xs font-medium text-muted-foreground` (remove uppercase, tracking).
3. **Replace `bg-background/60`** on evidence/action containers → use `bg-muted` (solid).
4. **Replace hardcoded badge colors** — `Badge variant={blindspot.severity > 70 ? "warning" : "secondary"}` already uses badge variants which will be fixed per badge spec above.

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Page title | 3xl→4xl | 600 | Geist Sans |
| Description | sm (14px) | 400 | Geist Sans |
| Module title | base (16px) | 600 | Geist Sans |
| Severity badge | xs (12px) | 500 | Geist Sans |
| Evidence label | xs (12px) | 500 | Geist Sans |
| Evidence text | sm (14px) | 400 | Geist Sans |

#### Interaction States
| Element | Default | Hover |
|---------|---------|-------|
| Blindspot card | border-border | border-primary/40 (subtle card hover) |
| Replay link | text-primary | underline |

#### Motion
- **Blindspot cards:** Staggered fade-in on mount. 0.1s stagger, 0.3s duration.
- **Progress bar:** CSS transition `transition-all duration-700 ease-out` on value changes.

#### Empty/Loading/Error
- **Loading:** 3 SkeletonCard components in vertical stack.
- **Empty:** Centered Card: "No blindspots identified yet" + "Complete some modules to generate your blindspot map."

---

### 7. Profile Page

#### Layout
- **Page header:** Title = user's name, description = user's email, action = IRS badge. — No eyebrow.
- **Content row 1:** 2-column grid at `lg` (`lg:grid-cols-[1fr_320px]`). Left = IRS radar chart. Right = streak tracker.
- **Content row 2:** 2-column grid at `md` (`md:grid-cols-2`). Left = "Session display" card. Right = "Recent modules" card.

#### Changes from Current
1. **Remove eyebrow badge** from PageHeader.
2. **Replace `bg-background/60`** on recent module items → use `bg-muted` (solid).
3. **Wire real radar data** — Replace `data={[]}` with actual profile radar data from tRPC query.

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Page title (name) | 3xl→4xl | 600 | Geist Sans |
| Description (email) | sm (14px) | 400 | Geist Sans |
| IRS badge | xs (12px) | 500 | Geist Sans |
| "Session display" heading | base (16px) | 600 | Geist Sans |
| Session info text | sm (14px) | 400 | Geist Sans |
| Recent module item | sm (14px) | 500 | Geist Sans |

#### Motion
- **Content sections:** Fade-in staggered entrance. Row 1 at 0s, Row 2 at 0.2s.

#### Empty/Loading/Error
- **Loading:** 2 SkeletonCard components in row 1 layout, then 2 more in row 2 layout.
- **Error:** Aggregate error state.
- **Empty:** "Profile data is not available yet." in centered Card.

---

### 8. Module Player

#### Layout
- **Page header:** Title = module title, subtitle = module content/summary, eyebrow = track name (but no longer a badge — use plain text label). — No eyebrow badge.
- **Content grid:** 2-column at `xl` (`xl:grid-cols-[1fr_360px]`). Left = main content (card + code editor). Right = sidebar (phase-specific content).
- **Phase selector:** 3-button row (`sm:grid-cols-3`) — Decode, Rebuild, Defend.
- **Code Editor:** Monaco editor wrapper with border, header bar (language label + reset button), and editor area.
- **Sidebar content changes by phase:**
  - Decode: Annotation editor + "Unlock rebuild" button
  - Rebuild: Quiz card + Code submission + "Start defend" button
  - Defend: Live defend card (questions + answers) + Diff viewer

#### Changes from Current
1. **Remove eyebrow badge** from PageHeader — Track name appears as a simple `text-sm text-muted-foreground` label above the title, not as a badge.
2. **Replace hardcoded quiz colors** — In `quiz-ui.tsx`:
   - `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` (complete state) → `border-success/30 bg-success/10 text-success`
   - `border-emerald-500/40 bg-emerald-500/10 text-emerald-300` (correct answer) → `border-success/40 bg-success/10 text-success`
3. **Replace hardcoded diff colors** — In `diff-viewer.tsx`:
   - `bg-emerald-500/10` → `var(--diff-add)` as `style={{ backgroundColor: "var(--diff-add)" }}`
   - `bg-red-500/10` → `var(--diff-remove)` as `style={{ backgroundColor: "var(--diff-remove)" }}`
4. **Replace hardcoded code editor colors** — In `code-editor.tsx`:
   - Replace `font-mono text-xs uppercase tracking-[0.18em]` with `font-mono text-xs text-muted-foreground` (remove uppercase, tracking)
5. **Replace `bg-background/50`** on inactive phase buttons → use `bg-muted` (solid).
6. **Replace `bg-background/60`** on various containers → use `bg-muted` (solid).
7. **Replace "Add mock answer"** button text → "Add response".

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Track label | sm (14px) | 400 | Geist Sans |
| Module title | 3xl→4xl | 600 | Geist Sans |
| Module summary | sm (14px) | 400 | Geist Sans |
| Estimated time badge | xs (12px) | 500 | Geist Sans |
| Phase button label | sm (14px) | 500 | Geist Sans |
| Section heading (sidebar) | base (16px) | 600 | Geist Sans |
| Question prompt | sm (14px) | 500 | Geist Sans |
| Option text | sm (14px) | 400 | Geist Sans |
| Explanation text | sm (14px) | 400 | Geist Sans |
| Code language label | xs (12px) | 400 | Geist Mono |
| Diff header | xs (12px) | 500 | Geist Mono |
| Diff content | xs (12px) | 400 | Geist Mono |

#### Phase Selector States
| Button | Default | Active | Hover | Disabled |
|--------|---------|--------|-------|----------|
| Inactive phase | `border-border bg-muted text-muted-foreground` | — | `hover:text-foreground` | — |
| Active phase | `border-primary bg-primary/10 text-primary` | — | — | — |

#### Quiz Interaction States
| Element | Default | Picked (not correct) | Picked (correct) | Picked (incorrect) | Disabled |
|---------|---------|---------------------|------------------|-------------------|----------|
| Option button | `border-border bg-muted text-foreground` | `border-primary text-primary` | `border-success/40 bg-success/10 text-success` | `border-destructive/40 bg-destructive/10 text-destructive` | — |
| Next/Finish button | bg-primary | — | — | — | `opacity-50 pointer-events-none` |

#### Motion
- **Phase transitions:** Framer-motion `AnimatePresence mode="wait"` for sidebar content swapping between phases. Cross-fade: opacity 0 → 1, duration 0.3s.
- **Quiz option selection:** CSS `transition-colors duration-150 ease-out`.
- **Code submission status:** CSS transition on badge and button states.

#### Empty/Loading/Error
- **Loading:** 3 SkeletonCard components matching the 1fr/360px grid layout.
- **Error:** Aggregate error state for track + module queries.
- **Empty:** "Module content is not available." in centered Card.
- **Code submission states:** idle → pending (with "Evaluating..." text) → success (green checkmark) → error (red error message with retry).

---

### 9. Auth Pages (Sign In / Sign Up)

#### Layout
- **Full-viewport centered:** `min-h-screen flex items-center justify-center p-4`.
- **Card:** `w-full max-w-md` centered, with Link back to landing at top.
- **Back link:** Logo + "UnVibe" text, navigates to `/`.
- **Card title:** "Sign in" or "Create account" at `text-2xl`.
- **OAuth buttons:** Full-width outline buttons with icons — GitHub + Google.
- **Email form:** Stacked Input fields with primary submit button.
- **Bottom link:** Contextual "New here? Create an account" or "Already training? Sign in".

#### Changes from Current
1. **Remove `surface-grid`** → replace with solid `bg-background` (background color from ThemeProvider gradient handles visual depth).
2. **Remove `bg-card/95 backdrop-blur`** → use `bg-card` (remove opacity and backdrop-blur on auth card).
3. **Replace `LoadingPanel` label** — "Signing in" / "Creating account" (these are already correct).
4. **Fix contrast on error text** — Error messages in `text-destructive` are fine (red is standard for validation errors, high contrast by nature).

#### Typography Map
| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Logo text | sm (14px) | 600 | Geist Sans |
| Card title | 2xl (24px) | 600 | Geist Sans |
| Card description | sm (14px) | 400 | Geist Sans |
| OAuth button text | sm (14px) | 500 | Geist Sans |
| Input placeholder | sm (14px) | 400 | Geist Sans |
| Input value | sm (14px) | 400 | Geist Sans |
| Validation error | sm (14px) | 400 | Geist Sans (destructive) |
| Bottom link | sm (14px) | 400 | Geist Sans |
| Bottom link anchor | sm (14px) | 500 | primary |

#### Interaction States
| Element | Default | Hover | Focus | Disabled |
|---------|---------|-------|-------|----------|
| OAuth button (outline) | bg-background border-border | bg-muted | ring-2 ring-ring | — |
| Text input | border-border bg-background | border-primary/60 | ring-2 ring-ring border-ring | opacity-50 |
| Submit button | bg-primary text-primary-foreground | bg-primary/90 | ring-2 ring-ring | opacity-50 pointer-events-none |
| Back link | text-foreground | text-primary | — | — |
| Bottom link | text-primary | text-primary/80 | underline | — |

#### Motion
- **Card entrance:** Framer-motion `fadeInUp` — opacity 0 → 1, y: 20 → 0, duration 0.5s, ease-out.
- **Form transition:** No animation on individual inputs.
- **Loading state transition:** Quick cross-fade to LoadingPanel (opacity 0.2s).

#### Empty/Loading/Error
- **Loading (during auth):** `LoadingPanel` with contextual label "Signing in" or "Creating account". Full card replacement while loading.
- **Error:** Inline `text-destructive` paragraph below form inputs. Specific messages per validation failure.
- **Empty:** Not applicable (forms always render).

---

## Motion Design System

### Principles
1. **Intentionality** — Every animation must serve a purpose: guide attention, provide feedback, or communicate hierarchy.
2. **Ease-out dominance** — Objects enter with ease-out, never ease-in. The default curve is `[0.16, 1, 0.3, 1]` (a custom cubic-bezier for snappy feel).
3. **Duration scale** — Micro-interactions: 150ms. Element transitions: 200-300ms. Page transitions: 300-500ms. Never exceed 500ms for UI animations.
4. **Reduced motion** — Always check `useReducedMotion()` from framer-motion. When true, skip all animations and render directly in final state.

### Framer-Motion Presets

```tsx
// Shared animation variants — define once in a shared file (@/lib/motion.ts)
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};
```

### Surface-Specific Motion Map

| Surface | Elements Animated | Pattern | Duration |
|---------|-----------------|---------|----------|
| Landing | Hero content, feature cards, sample card | fadeInUp + staggerContainer | 0.4-0.6s |
| App Shell | Page content on route change | fadeIn (AnimatePresence) | 0.2s |
| Dashboard | Stat cards, grid sections | fadeInUp + staggerContainer | 0.3-0.4s |
| Tracks | Track cards | fadeInUp + staggerContainer | 0.4s |
| War Room | New messages | slideUp (AnimatePresence) | 0.2s |
| Blindspot Map | Blindspot cards | fadeInUp + staggerContainer | 0.3s |
| Profile | Content sections | fadeIn | 0.3s |
| Module Player | Phase content swap | fadeIn (AnimatePresence mode="wait") | 0.3s |
| Auth | Auth card | fadeInUp | 0.5s |

### CSS Transitions (No Framer-Motion Needed)

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Link hover | color | 150ms | ease-out |
| Button hover | background-color | 150ms | ease-out |
| Card hover | border-color | 200ms | ease-out |
| Input focus | border-color, box-shadow | 200ms | ease-out |
| Progress bar | width | 500ms | ease-out |
| Badge | All | 150ms | ease-out |

---

## Pattern Library — Reusable Design Patterns

### Page Pattern (All App Surfaces)

```
┌─────────────────────────────────────────────┐
│  PageHeader (no eyebrow)                     │
│  • h1 title (3xl sm:4xl font-semibold)      │
│  • p description (sm text-muted-foreground)  │
│  • optional action (Button, right-aligned)   │
├─────────────────────────────────────────────┤
│  Content Grid                                │
│  • gap-4 as default grid gap                │
│  • responsive columns per layout             │
│  • Cards with shadow-sm                      │
└─────────────────────────────────────────────┘
```

### Stat Card Pattern

```
┌─────────────────────────┐
│  CardHeader              │
│  ┌───────────┬────────┐ │
│  │ CardTitle  │ Icon  │ │
│  └───────────┴────────┘ │
│  CardContent             │
│  • Stat value (3xl mono) │
│  • Label (sm muted)      │
└─────────────────────────┘
```

### Empty State Pattern

```
┌─────────────────────────────┐
│  Card (centered text)        │
│  CardContent (py-12)         │
│  • Icon (optional, muted)    │
│  • Heading (text-lg font-medium) │
│  • Body (text-sm muted)      │
│  • Action button (optional)  │
└─────────────────────────────┘
```

### Error State Pattern

```
┌─────────────────────────────────┐
│  div[role="alert"]               │
│  bg-destructive/10 p-6 text-center │
│  • Heading (font-medium destructive)│
│  • Body (text-sm muted)          │
└─────────────────────────────────┘
```

### Loading Skeleton Pattern

```
┌─────────────────────────────┐
│  div[role="status"]          │
│  aria-label contextual       │
│  • animate-pulse blocks      │
│  • mirrors actual layout     │
│  • sr-only "Loading..."      │
└─────────────────────────────┘
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Default (mobile) | < 640px | Single column. Bottom nav visible. Sidebar hidden. |
| sm | ≥ 640px | 2-column grids activate. Sidebar hidden. |
| md | ≥ 768px | 3-column grids activate (stat cards). |
| lg | ≥ 1024px | Sidebar visible (w-64). Desktop layout. Bottom nav hidden. 2-column content grids. |
| xl | ≥ 1280px | Module player 2-column activates. max-w-7xl content width. |

---

## Accessibility Contract

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | All text meets WCAG AA 4.5:1 minimum. No opacity modifiers on text colors. |
| Focus indicators | `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements. |
| Screen reader labels | `sr-only` for loading states. `role="status"` on dynamic content. `aria-label` on icon-only buttons. |
| Semantic HTML | `<main>`, `<nav>`, `<aside>`, `<footer>`, `<h1>`, `<h2>` hierarchy. |
| Reduced motion | Framer-motion `useReducedMotion()` check on all animations. |
| Touch targets | Minimum 44×44px for mobile navigation items. |
| Keyboard navigation | Tab order follows visual order. All interactive elements reachable via keyboard. |
| Form validation | Inline error messages with `text-destructive`. Real-time validation where appropriate. |
| Error announcements | Error containers use `role="alert"`. |
| Disabled states | `disabled:opacity-50` + `disabled:pointer-events-none` or `disabled:cursor-not-allowed`. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Button, Card, Badge, Input, Textarea, Progress | Not required — all standard shadcn components. No third-party registries. |

No third-party registries are used. All components are either hand-crafted or standard shadcn/ui components.

---

## Implementation Priority — Critical Fixes First

The UI-AUDIT.md identified 3 critical fixes. These must be implemented before any visual polish:

### Critical Fix 1: Remove Eyebrow Badge Pattern
**Files affected:** `page-header.tsx`, `dashboard/page.tsx`, `tracks/page.tsx`, `war-room/page.tsx`, `blindspot-map/page.tsx`, `profile/page.tsx`, `page.tsx` (landing sample module label), `app-shell.tsx` (email display), `code-editor.tsx` (language label), `diff-viewer.tsx` (column headers)
**Action:** Replace `PageHeader` component — remove the `eyebrow` prop entirely. For each surface, ensure title + description provide sufficient context. Replace all `uppercase tracking-[0.18em]` and `uppercase tracking-[0.22em]` patterns with plain text.

### Critical Fix 2: Replace Developer-Facing Copy
**Files affected:** `page.tsx` (CTA), `dashboard/page.tsx` (description), `war-room/page.tsx` (description)
**Action:** Replace copy per Copywriting Contract table above.

### Critical Fix 3: Replace Hardcoded Colors with Theme Tokens
**Files affected:** `badge.tsx`, `quiz-ui.tsx`, `diff-viewer.tsx`, `streak-tracker.tsx`, `page.tsx` (code block), `irs-radar-chart.tsx` (muted-foreground/60)
**Action:** Replace per Color section above. Add new semantic tokens (`--success`, `--warning`, `--diff-add`, `--diff-remove`, `--code-bg`) to `globals.css`.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PENDING — All developer-facing copy replaced, eyebrow badges removed
- [ ] Dimension 2 Visuals: PENDING — surface-grid removed, backdrop-blur standardized, no AI slop patterns
- [ ] Dimension 3 Color: PENDING — All hardcoded colors replaced with theme tokens, new semantic tokens added
- [ ] Dimension 4 Typography: PENDING — text-[11px] removed, font-normal added to body, uppercase tracking removed
- [ ] Dimension 5 Spacing: PENDING — min-h-[400px] replaced, opacity levels standardized
- [ ] Dimension 6 Registry Safety: PASS — No third-party registries, all shadcn official

**Approval:** pending
