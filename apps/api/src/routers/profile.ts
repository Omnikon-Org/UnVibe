import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";

export const profileRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    // Get latest IRS score
    const latestScore = await ctx.prisma.iRSScore.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Count completed modules
    const completedModules = await ctx.prisma.submission.count({
      where: { userId, status: { in: ["scored", "defended"] } },
    });

    // Count unique started modules
    const startedModules = await ctx.prisma.submission.findMany({
      where: { userId },
      select: { moduleId: true },
      distinct: ["moduleId"],
    });

    // Count defend sessions
    const defendCount = await ctx.prisma.defendSession.count({
      where: { userId },
    });

    return {
      id: user.id,
      name: user.name ?? "Anonymous",
      email: user.email,
      image: user.image,
      irs: latestScore?.score ?? 0,
      completedModules,
      startedModulesCount: startedModules.length,
      defendCount,
      memberSince: user.createdAt,
    };
  }),

  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const submissions = await ctx.prisma.submission.findMany({
        where: { userId },
        include: { module: { select: { title: true, trackId: true } } },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 5,
      });

      return submissions.map((sub) => ({
        id: sub.id,
        moduleId: sub.moduleId,
        moduleTitle: sub.module?.title ?? "Unknown",
        status: sub.status,
        score: sub.feedback ? extractScore(sub.feedback) : null,
        createdAt: sub.createdAt,
      }));
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Total submissions
    const totalSubmissions = await ctx.prisma.submission.count({ where: { userId } });

    // Submissions by status
    const scoredCount = await ctx.prisma.submission.count({
      where: { userId, status: { in: ["scored", "defended"] } },
    });
    const failedCount = await ctx.prisma.submission.count({
      where: { userId, status: "failed" },
    });
    const pendingCount = await ctx.prisma.submission.count({
      where: { userId, status: "pending" },
    });

    // Average score from scored submissions
    const scoredSubs = await ctx.prisma.submission.findMany({
      where: { userId, status: { in: ["scored", "defended"] } },
      select: { feedback: true },
    });

    let totalScore = 0;
    let scoreCount = 0;
    for (const sub of scoredSubs) {
      const score = sub.feedback ? extractScore(sub.feedback) : null;
      if (score !== null) {
        totalScore += score;
        scoreCount++;
      }
    }

    const averageScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 100) : 0;

    // Streak calculation - count consecutive days
    const submissions = await ctx.prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    let currentStreak = 0;
    const dates = new Set<string>();
    for (const sub of submissions) {
      const dateKey = sub.createdAt.toISOString().split("T")[0];
      dates.add(dateKey);
    }

    const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
    const lastActiveDate: string | null = sortedDates.length > 0 ? sortedDates[0] : null;
    if (sortedDates.length > 0) {
      currentStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const curr = new Date(sortedDates[i - 1]);
        const prev = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      totalSubmissions,
      scoredCount,
      failedCount,
      pendingCount,
      averageScore,
      currentStreak,
      lastActive: lastActiveDate ? new Date(lastActiveDate) : null,
    };
  }),
});

function extractScore(feedback: string): number | null {
  try {
    const parsed = JSON.parse(feedback);
    if (typeof parsed.overallScore === "number") return parsed.overallScore;
    return null;
  } catch {
    return null;
  }
}
