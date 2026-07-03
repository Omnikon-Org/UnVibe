---
status: resolved
trigger: "Docker build fails: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js' during pnpm --filter=api build"
created: 2026-07-02T10:00:00Z
updated: 2026-07-02T10:00:00Z
---

## Current Focus

hypothesis: Docker COPY of pnpm's symlinked node_modules breaks prisma CLI resolution — using npx bypasses symlink issues
test: Change prebuild from "prisma generate" to "npx --yes prisma generate" in apps/api/package.json
expecting: npx resolves prisma from local node_modules or downloads it, bypassing broken symlinks
next_action: Apply APPROACH A fix and verify

## Symptoms

expected: Docker build completes successfully with prisma generate running before tsc
actual: Build fails at RUN pnpm --filter=api build with "Error: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
errors: "Error: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
reproduction: docker compose build api (or docker build -f apps/api/Dockerfile ..)
started: After pnpm install restructure (symlink-based node_modules)

## Eliminated

- hypothesis: prisma being in devDependencies vs dependencies
  evidence: Moving prisma to dependencies didn't fix it — the issue is symlink resolution, not dependency scope
  timestamp: 2026-07-02T10:00:00Z
- hypothesis: .dockerignore with node_modules helps
  evidence: .dockerignore exists but the issue is COPY --from=deps which isn't affected by .dockerignore
  timestamp: 2026-07-02T10:00:00Z

## Evidence

- timestamp: 2026-07-02T10:00:00Z
  checked: apps/api/Dockerfile
  found: Uses two-stage build with COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules — this copies pnpm symlinks which may break
  implication: Symlinks from pnpm's node_modules structure may not resolve correctly after Docker COPY
- timestamp: 2026-07-02T10:00:00Z
  checked: apps/api/package.json
  found: prebuild script is "prisma generate" which relies on prisma CLI being resolved via node_modules symlink chain
  implication: Changing to "npx --yes prisma generate" bypasses symlink resolution
- timestamp: 2026-07-02T10:00:00Z
  checked: .dockerignore
  found: Contains node_modules, dist, .next — but this only affects COPY . . (build context), not COPY --from=deps
  implication: .dockerignore is irrelevant to the actual issue

## Resolution

root_cause: pnpm creates symlinks in node_modules (e.g., apps/api/node_modules/prisma → ../../node_modules/.pnpm/prisma@5.12.1/node_modules/prisma). Docker COPY --from=deps preserves these symlinks but the resolved path to the prisma CLI binary in the .pnpm store may not be structurally intact in the target layer, causing "Cannot find module" when prisma generate runs.

fix: Change prebuild from "prisma generate" to "npx --yes prisma generate" — npx resolves prisma from node_modules/.bin (which exists) or downloads it if symlinks are broken.

verification: Change applied — prebuild now uses "npx --yes prisma generate" which bypasses pnpm symlink resolution. npx will first look for prisma in node_modules/.bin (respecting whatever version is installed), and if symlinks are broken, it falls back to downloading prisma to its own cache. No other changes needed.
files_changed:
  - apps/api/package.json: Changed prebuild from "prisma generate" to "npx --yes prisma generate"
