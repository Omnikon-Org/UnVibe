---
status: awaiting_human_verify
trigger: "Docker build failing: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js' — prisma CLI can't find itself after Docker COPY"
created: 2026-07-02T14:30:00Z
updated: 2026-07-02T14:30:00Z
---

## Current Focus

hypothesis: Running prisma generate in the deps stage (where pnpm symlinks are intact) and removing the prebuild script from the build stage will fix the Docker build
test: Add prisma schema copy + prisma generate to deps stage in Dockerfile, remove prebuild from package.json, rebuild
expecting: Build succeeds — prisma generate runs in deps where symlinks work, generated client is copied to build stage, tsc compiles without needing prebuild
next_action: Update debug file, present checkpoint for verification

## Symptoms

expected: Docker build completes successfully
actual: Build fails at pnpm --filter=api build with prisma CLI error
errors: "Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
reproduction: docker compose build api (from infra/) or docker build -f apps/api/Dockerfile ..
started: Always broken with current Dockerfile

## Eliminated

- hypothesis: .dockerignore fixes it (preventing host node_modules from overwriting deps)
  evidence: .dockerignore already exists but build still fails — likely Docker layer cache or npx behavior
  timestamp: 2026-07-02T14:30:00Z
- hypothesis: npx --yes bypasses prisma CLI symlink issue
  evidence: Resolved debug session shows fix was applied but user reports the error persists
  timestamp: 2026-07-02T14:30:00Z

## Evidence

- timestamp: 2026-07-02T14:30:00Z
  checked: apps/api/Dockerfile
  found: deps stage runs pnpm install but doesn't run prisma generate; build stage runs pnpm build (with prebuild calling prisma generate)
  implication: Moving prisma generate to deps stage avoids symlink breakage from Docker COPY

- timestamp: 2026-07-02T14:30:00Z
  checked: apps/api/package.json
  found: prebuild="npx --yes prisma generate", build="tsc"
  implication: prebuild can be removed since generate runs in deps; tsc doesn't need prisma generate

- timestamp: 2026-07-02T14:30:00Z
  checked: .dockerignore
  found: Already exists with node_modules, dist, .next
  implication: Should prevent host node_modules from COPY . . but doesn't fix the core symlink issue

## Resolution

root_cause: pnpm's node_modules uses symlinks into .pnpm store. Docker COPY --from=deps preserves symlinks but they may not fully resolve in the build stage, causing prisma CLI to fail finding build/index.js. The prebuild script (prisma generate) relies on prisma CLI which depends on intact symlinks.

fix: Move prisma generate to the deps stage where pnpm's symlink chain is fully intact, and remove the prebuild script from package.json

verification: Pending — needs user to rebuild and confirm
files_changed:
  - apps/api/Dockerfile: Added COPY apps/api/prisma + RUN pnpm --filter=api exec prisma generate to deps stage (lines 12-13)
  - apps/api/package.json: Removed prebuild script (prisma generate now runs in deps stage; build just runs tsc)
