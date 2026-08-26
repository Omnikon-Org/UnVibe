import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getLeaderboard } from "../services/leaderboard";

export const warRoomRouter = router({
  getRoom: publicProcedure.query(async ({ ctx }) => {
    const room = await ctx.prisma.warRoom.findFirst({
      orderBy: { createdAt: "desc" },
    });
    // Return null instead of throwing, so the frontend can show a meaningful empty state
    return room ?? null;
  }),

  getMessages: publicProcedure.query(async () => {
    // Real-time messaging was handled via Socket.io on the old Express API;
    // it returns an empty array until real-time is reintroduced.
    return [];
  }),

  getLeaderboard: publicProcedure.query(async ({ ctx }) => {
    return getLeaderboard(ctx.prisma, 20);
  }),

  joinRoom: protectedProcedure.input(z.object({ roomId: z.string() })).mutation(async ({ ctx, input }) => {
    const room = await ctx.prisma.warRoom.findUnique({
      where: { id: input.roomId },
    });
    if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    return { room, success: true };
  }),
});
