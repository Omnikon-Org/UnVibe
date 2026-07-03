import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import pino from "pino";

const logger = pino({ name: "submissions-router" });

export const submissionsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        moduleId: z.string(),
        code: z.string().min(1, "Code cannot be empty"),
        originalCode: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify module exists
      const module = await ctx.prisma.module.findUnique({
        where: { id: input.moduleId },
      });
      if (!module) throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });

      // Check for existing pending submission
      const existingPending = await ctx.prisma.submission.findFirst({
        where: { userId, moduleId: input.moduleId, status: "pending" },
      });
      if (existingPending) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have a pending submission for this module. Please wait for it to be scored." });
      }

      // Create submission with pending status
      const submission = await ctx.prisma.submission.create({
        data: {
          userId,
          moduleId: input.moduleId,
          code: input.code,
          status: "pending",
        },
      });

      // Enqueue to BullMQ for async scoring — best-effort, clean up on failure
      if (ctx.submissionQueue) {
        try {
          await ctx.submissionQueue.add("process-submission", {
            submissionId: submission.id,
            userId,
            moduleId: input.moduleId,
            code: input.code,
            originalCode: input.originalCode ?? module.content,
            language: "typescript",
          });
        } catch (err) {
          // Queue failed — submission remains as pending orphan
          logger.error({ err, submissionId: submission.id }, "Failed to enqueue submission");
        }
      }

      return {
        id: submission.id,
        status: submission.status,
        queued: ctx.submissionQueue !== null,
      };
    }),

  getHistory: protectedProcedure
    .input(
      z
        .object({
          moduleId: z.string().optional(),
          limit: z.number().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const where: { userId: string; moduleId?: string } = { userId };
      if (input?.moduleId) where.moduleId = input.moduleId;

      const submissions = await ctx.prisma.submission.findMany({
        where,
        include: { module: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
      });

      return submissions.map((sub) => ({
        ...sub,
        parsedFeedback: sub.feedback ? tryParseFeedback(sub.feedback) : null,
      }));
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const submission = await ctx.prisma.submission.findUnique({
      where: { id: input.id },
      include: { module: { select: { title: true, content: true } } },
    });

    if (!submission)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Submission not found",
      });
    if (submission.userId !== ctx.session.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not your submission",
      });
    }

    return {
      ...submission,
      parsedFeedback: submission.feedback ? tryParseFeedback(submission.feedback) : null,
    };
  }),
});

function tryParseFeedback(feedback: string): unknown {
  try {
    return JSON.parse(feedback) as unknown;
  } catch {
    return null;
  }
}
