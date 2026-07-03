---
status: awaiting_human_verify
trigger: "Docker build fails at `RUN pnpm --filter=api build` with: Error: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
created: 2026-07-02T12:00:00Z
updated: 2026-07-02T12:00:00Z
---

## Current Focus

hypothesis: prisma CLI is in devDependencies but needed at build time — Docker COPY doesn't properly handle pnpm's symlink structure for devDependencies
test: reading all relevant files to confirm the dependency classification and Docker build stages
expecting: prisma will be found in devDependencies, and the Dockerfile's deps stage may not make it available correctly
next_action: compile all evidence and present root cause with fix

## Symptoms

expected: Docker build completes successfully with prisma generate running before tsc
actual: Docker build fails at `pnpm --filter=api build` step with `Error: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'`
errors: "Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
reproduction: Run `docker compose build api` or `docker build -f apps/api/Dockerfile .`
started: Unknown — likely always broken with current configuration

## Eliminated

## Evidence

- timestamp: 2026-07-02T12:00:00Z
  checked: apps/api/package.json
  found: `prisma: "^5.12.1"` is in `devDependencies` (line 35); `@prisma/client: "^5.12.1"` is in `dependencies` (line 15); `prebuild` script runs `prisma generate` (line 7)
  implication: The prisma CLI (needed for `prisma generate`) is classified as a dev-only dependency

- timestamp: 2026-07-02T12:00:00Z
  checked: apps/api/Dockerfile
  found: Two-stage build: `deps` stage runs `pnpm install --frozen-lockfile`; `build` stage copies node_modules from deps then runs `pnpm --filter=api build`
  implication: The deps stage installs ALL deps (including devDeps) by default, but Docker COPY of pnpm's symlinked node_modules structure may not preserve/resolve all packages correctly

- timestamp: 2026-07-02T12:00:00Z
  checked: infra/docker-compose.yml
  found: api service builds from apps/api/Dockerfile, context is project root
  implication: Build context is correct, no issue there

- timestamp: 2026-07-02T12:00:00Z
  checked: pnpm-workspace.yaml, turbo.json, root package.json
  found: Standard pnpm workspace with apps/* and packages/*; no .npmrc or pnpm config that changes install behavior
  implication: No hidden configuration is altering how devDependencies are installed

## Resolution

root_cause: "prisma CLI is listed in devDependencies but is required at build time for the `prebuild` script (`prisma generate`). In pnpm's strict node_modules layout, devDependency packages are symlinked into the `.pnpm` store. Docker's `COPY --from=deps` follows these symlinks, but when prisma's binary (in .bin/) tries to resolve its own module location relative to the binary, the path `../prisma/build/index.js` resolves to the build stage's `apps/api/node_modules/prisma/build/index.js`, which may not exist if Docker's symlink resolution during COPY didn't place the content at that exact path."
fix: "Moved `prisma` from `devDependencies` to `dependencies` in apps/api/package.json (alphabetically placed between pino-pretty and socket.io)"
verification: "Verified file edit applied correctly — `prisma` is now in dependencies block with same version ^5.12.1. Run `pnpm install` to regenerate lockfile, then `docker compose build api` to confirm."
files_changed:
  - apps/api/package.json
