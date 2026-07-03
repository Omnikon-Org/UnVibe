---
status: resolved
trigger: "tRPC batch request to http://localhost:3001/trpc/tracks.getById,modules.getById?batch=1... returns 404 errors"
created: 2026-07-02T20:50:00Z
updated: 2026-07-02T20:55:00Z
---

## Current Focus

root_cause_confirmed: true

## Symptoms

expected: |
  tRPC batch request should return track and module data from the database
actual: |
  tRPC returns JSON-RPC errors with code -32004, httpStatus 404:
  - tracks.getById: "Track not found"
  - modules.getById: "Module not found"
errors: |
  [{"error":{"message":"Track not found","code":-32004,"data":{"code":"NOT_FOUND","httpStatus":404,...}}},
   {"error":{"message":"Module not found","code":-32004,"data":{"code":"NOT_FOUND","httpStatus":404,...}}}]
reproduction: |
  1. Navigate to http://localhost:3000/app/dashboard
  2. Click "Resume module" button
  3. Module page calls trpc.tracks.getById and trpc.modules.getById
  4. Both return NOT_FOUND errors
started: always broken (database never seeded)

## Eliminated

- hypothesis: "API server is not running on port 3001"
  evidence: Netstat shows PID 24600 listening on port 3001. /health endpoint returns 200 with {"status":"ok","service":"api"}
  timestamp: 2026-07-02T20:51:00Z

- hypothesis: "tRPC procedures are incorrectly named"
  evidence: Read tracks.ts and modules.ts — both have getById procedures. The router in index.ts correctly maps tracks and modules keys.
  timestamp: 2026-07-02T20:51:00Z

- hypothesis: "Batch request format is wrong for this tRPC version"
  evidence: The server accepts the request format (returns 200 HTTP status with JSON-RPC errors). The tRPC middleware is routing correctly.
  timestamp: 2026-07-02T20:51:00Z

- hypothesis: "tRPC middleware is mounted at wrong path"
  evidence: index.ts line 163-169 mounts trpcExpress.createExpressMiddleware at "/trpc". The client URL is "http://localhost:3001/trpc" — correct match.
  timestamp: 2026-07-02T20:51:00Z

- hypothesis: "NEXT_PUBLIC_API_URL is set to wrong port"
  evidence: .env.local has no NEXT_PUBLIC_API_URL. Client falls back to default "http://localhost:3001" which is correct.
  timestamp: 2026-07-02T20:51:00Z

## Evidence

- timestamp: 2026-07-02T20:50:00Z
  checked: Netstat for port 3001
  found: TCP 0.0.0.0:3001 LISTENING (PID 24600)
  implication: API server IS running

- timestamp: 2026-07-02T20:50:00Z
  checked: /health endpoint
  found: 200 OK — {"status":"ok","service":"api"}
  implication: Express server is running and responding

- timestamp: 2026-07-02T20:50:00Z
  checked: apps/api/src/index.ts — tRPC middleware mount
  found: app.use("/trpc", trpcExpress.createExpressMiddleware(...)) at line 163
  implication: Mount path is correct

- timestamp: 2026-07-02T20:50:00Z
  checked: apps/web/src/lib/trpc/provider.tsx — client URL
  found: url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/trpc` at line 14
  implication: Client URL matches server mount path

- timestamp: 2026-07-02T20:51:00Z
  checked: apps/api/src/routers/tracks.ts — getById procedure
  found: getById: publicProcedure.input(z.object({ id: z.string() })).query(...) exists at line 19
  implication: Procedure is correctly defined

- timestamp: 2026-07-02T20:51:00Z
  checked: apps/api/src/routers/modules.ts — getById procedure
  found: getById: publicProcedure.input(z.object({ id: z.string() })).query(...) exists at line 6
  implication: Procedure is correctly defined

- timestamp: 2026-07-02T20:52:00Z
  checked: apps/api/src/index.ts — router structure
  found: router({ tracks: tracksRouter, modules: modulesRouter, ... }) at lines 121-133
  implication: Router keys match procedure paths

- timestamp: 2026-07-02T20:52:00Z
  checked: tracks.getAll via tRPC
  found: returns [] (empty array)
  implication: DATABASE IS EMPTY — no seed data exists

- timestamp: 2026-07-02T20:53:00Z
  checked: Docker containers
  found: postgres:16-alpine running (unvibe-postgres), redis:7-alpine running (unvibe-redis)
  implication: Database service is available but empty

- timestamp: 2026-07-02T20:54:00Z
  checked: apps/api/prisma/seed.ts
  found: Seed file has tracks with ids: "track-frontend-systems", "track-ai-workflows", "track-backend-foundations" and modules with ids: "mod-react-state", "mod-css-layout", "mod-prompt-eng", "mod-rag-pipeline", "mod-api-design"
  implication: Seed data uses prefix pattern (track-, mod-) but dashboard hardcodes un-prefixed IDs

- timestamp: 2026-07-02T20:54:00Z
  checked: apps/web/src/app/app/dashboard/page.tsx line 49
  found: Hardcoded link href="/app/tracks/frontend-systems/modules/auth-guard-rebuild"
  implication: Link uses wrong IDs — should be "track-frontend-systems" (prefix missing) and "mod-react-state" or "mod-css-layout" (module doesn't exist)

- timestamp: 2026-07-02T20:54:00Z
  checked: Ran pnpm --filter api db:seed (with DATABASE_URL set)
  found: "Seeding database... Seeding complete."
  implication: Data now populated

- timestamp: 2026-07-02T20:55:00Z
  checked: tracks.getAll after seeding
  found: Returns 2 tracks with modules — data correctly populated
  implication: Seed successful

- timestamp: 2026-07-02T20:55:00Z
  checked: tracks.getById + modules.getById with correct IDs
  found: 200 OK with full data for {"id":"track-frontend-systems"} and {"id":"mod-react-state"}
  implication: API works correctly with proper IDs

## Resolution

root_cause: |
  Two issues:

  1. **Primary: Database never seeded.** PostgreSQL container was running but had no data. The Prisma seed command had never been executed, so tracks.getAll returned [] and all getById calls returned NOT_FOUND.

  2. **Secondary: Dashboard hardcoded wrong IDs.** Even after seeding, the "Resume module" button in dashboard/page.tsx linked to /app/tracks/frontend-systems/modules/auth-guard-rebuild, but the actual seed data uses prefixed IDs like "track-frontend-systems" and "mod-react-state". The module ID "auth-guard-rebuild" doesn't exist anywhere in the seed data.

  Port 3001 vs 3000: This is by design. The Next.js frontend (port 3000) is a separate process from the Express API (port 3001). tRPC client is correctly configured to call port 3001.

fix: |
  1. Ran `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unvibe?schema=public"; pnpm --filter api db:seed` to seed the database.

  2. Updated dashboard/page.tsx line 49 to dynamically compute the "Resume module" link from the first track's first module instead of hardcoded IDs:
     - Old: href="/app/tracks/frontend-systems/modules/auth-guard-rebuild"
     - New: href={activeTrack?.modules?.[0] ? `/app/tracks/${activeTrack.id}/modules/${activeTrack.modules[0].id}` : "/app/tracks"}

verification: |
  - tracks.getAll now returns 2 tracks (Frontend Systems, AI Workflows) with their modules
  - tracks.getById({ id: "track-frontend-systems" }) returns full track data with modules
  - modules.getById({ id: "mod-react-state" }) returns module data
  - Dynamic link will use correct real IDs from the database

files_changed:
  - apps/web/src/app/app/dashboard/page.tsx
---
