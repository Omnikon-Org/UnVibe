---
status: investigating
trigger: "Docker build failing: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
created: 2026-07-02T12:00:00Z
updated: 2026-07-02T12:00:00Z
---

## Current Focus

hypothesis: "No `.dockerignore` — `COPY . .` on Dockerfile line 16 copies the host's local `node_modules` (root + apps/api/), overwriting the properly-installed pnpm `node_modules` from the `deps` stage. This causes prisma's `build/index.js` to be missing or the node_modules structure to be broken inside the container."
test: "Create `.dockerignore` excluding `node_modules` and rebuild"
expecting: "Build succeeds — prisma binary resolves correctly because Docker's `COPY --from=deps` resolves symlinks to actual files, and prisma's CLI is a self-contained bundle so location change doesn't break requires"
next_action: "Write the fix — create `.dockerignore` + verify Dockerfile structure is correct"

## Symptoms

expected: "`docker compose build api` completes successfully — pnpm --filter=api build runs prisma generate then tsc"
actual: "Build fails during `RUN pnpm --filter=api build` with: Error: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
errors: "Error: Cannot find module '/app/apps/api/node_modules/prisma/build/index.js'"
reproduction: "Run `docker compose build api` from infra/ directory"
started: "Always broken (current Dockerfile has never had `.dockerignore`)"

## Eliminated

- hypothesis: "prisma was in devDependencies not dependencies"
  evidence: "User already moved prisma to dependencies — error persists"
  timestamp: "2026-07-02"

## Evidence

- timestamp: "2026-07-02"
  checked: "apps/api/package.json"
  found: "prisma is in dependencies (line 27) — confirmed moved from devDependencies"
  implication: "The devDependencies vs dependencies theory is ruled out"

- timestamp: "2026-07-02"
  checked: "Dockerfile at apps/api/Dockerfile"
  found: "Line 16: `COPY . .` — no `.dockerignore` exists. Both root `node_modules/` and `apps/api/node_modules/` exist on the host filesystem and would be copied, overwriting the deps-stage installations from lines 14-15."
  implication: "Host's local node_modules (Windows symlinks/junctions) get copied into the Linux container, breaking the module resolution"

- timestamp: "2026-07-02"
  checked: "Root project — `.dockerignore` file"
  found: "No `.dockerignore` exists at the project root"
  implication: "No exclusion of local node_modules from COPY commands"

- timestamp: "2026-07-02"
  checked: "prisma package structure at node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
  found: "prisma CLI is a fully self-contained esbuild bundle (2591 lines, all dependencies inlined). It does NOT have relative require() calls that depend on file location."
  implication: "Even if Docker's COPY --from=deps resolves the .bin/prisma symlink and copies the file to a different path, the bundle is self-contained and will execute correctly"

- timestamp: "2026-07-02"
  checked: "Host filesystem — apps/api/node_modules/prisma"
  found: "prisma is a ReparsePoint (directory symlink) pointing to ../../node_modules/.pnpm/prisma@5.22.0/node_modules/prisma. This is a Windows symlink that will NOT work correctly inside a Linux Docker container."
  implication: "When COPY . . overwrites the deps-stage node_modules with host files, the Windows symlinks break in the Linux container"

- timestamp: "2026-07-02"
  checked: "apps/api/Dockerfile line 15 — `COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules`"
  found: "This correctly copies the api's node_modules from the deps stage (resolving pnpm symlinks to actual files). After this line, `apps/api/node_modules/prisma/build/index.js` exists as a real file in the build stage."
  implication: "Line 15 works correctly. The problem is line 16 overwrites it."

- timestamp: "2026-07-02"
  checked: "apps/api/Dockerfile line 14 — `COPY --from=deps /app/node_modules ./node_modules`"
  found: "This correctly copies the root node_modules (including .pnpm store) from deps stage. The .pnpm directory is a real directory with real files, copied correctly by Docker."
  implication: "Root node_modules with .pnpm store is available in the build stage. The prisma package content exists at node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"

## Resolution

root_cause: "No `.dockerignore` in the project. `COPY . .` on Dockerfile line 16 copies the host's local `node_modules` (both root and `apps/api/`), overwriting the properly pnpm-installed node_modules from the `deps` stage (lines 14-15). The host's local `node_modules` contain Windows symlinks (ReparsePoints) that don't work inside the Linux Docker container, causing prisma's CLI entry point to be missing at `/app/apps/api/node_modules/prisma/build/index.js`."
fix: "Create `.dockerignore` at project root excluding `node_modules`, `dist`, and `.next` directories. This prevents `COPY . .` from overwriting the deps-stage node_modules. Docker's `COPY --from=deps` resolves pnpm symlinks to actual files, and prisma's CLI is a self-contained bundle, so the build works correctly with just the `.dockerignore` addition."
verification: "Pending"
files_changed:
  - ".dockerignore"
fix_applied:
  - "Created .dockerignore at project root excluding node_modules, dist, .next"
