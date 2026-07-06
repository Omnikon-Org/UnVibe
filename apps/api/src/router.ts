import { router, publicProcedure } from "./trpc";
import { authRouter } from "./routers/auth";
import { tracksRouter } from "./routers/tracks";
import { modulesRouter } from "./routers/modules";
import { irsRouter } from "./routers/irs";
import { warRoomRouter } from "./routers/warRoom";
import { submissionsRouter } from "./routers/submissions";
import { profileRouter } from "./routers/profile";
import { judge0Router } from "./routers/judge0";

// tRPC router — pure type definition, no runtime dependencies
export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date() };
  }),
  auth: authRouter,
  tracks: tracksRouter,
  modules: modulesRouter,
  submissions: submissionsRouter,
  irs: irsRouter,
  warRoom: warRoomRouter,
  profile: profileRouter,
  judge0: judge0Router,
});

export type AppRouter = typeof appRouter;