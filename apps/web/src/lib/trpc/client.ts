import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/router";

/**
 * tRPC client for the UnVibe API (served by this same app at /api/trpc).
 *
 * Infers the full router type from the server router via a type-only import,
 * so the client automatically gains access to new procedures with full type
 * safety as the router grows. Type-only imports are erased at build time —
 * no server code is bundled into the client.
 */
export const trpc = createTRPCReact<AppRouter>();
