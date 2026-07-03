# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## unused-usestate-import — unused useState import in code-submission component
- **Date:** 2026-07-02
- **Error patterns:** useState, defined but never used, @typescript-eslint/no-unused-vars, code-submission
- **Root cause:** useState was imported but never used — the component uses Zustand (useEditorStore) and tRPC mutation state instead of local React state.
- **Fix:** Removed useState from the React import statement.
- **Files changed:** apps/web/src/components/features/code-submission.tsx
---

## trpc-404-database-not-seeded — tRPC batch requests returning NOT_FOUND for tracks.getById and modules.getById
- **Date:** 2026-07-02
- **Error patterns:** tracks.getById, modules.getById, NOT_FOUND, Track not found, Module not found, batch=1, httpStatus 404, TRPCError, database seed
- **Root cause:** Two issues: (1) PostgreSQL database had no seed data — `prisma db seed` was never executed, so all getById queries returned NOT_FOUND; (2) dashboard "Resume module" button used hardcoded IDs (`frontend-systems`, `auth-guard-rebuild`) that don't match actual seed data IDs (`track-frontend-systems`, `mod-react-state`).
- **Fix:** Ran `pnpm --filter api db:seed` to populate the database, and fixed the dashboard link to dynamically compute the URL from the first track's first module instead of hardcoded IDs.
- **Files changed:** apps/web/src/app/app/dashboard/page.tsx
---

