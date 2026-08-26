import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import pino from "pino";
import { gradeSubmission } from "../services/grader";

const logger = pino({ name: "modules-router" });

export const modulesRouter = router({
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const mod = await ctx.prisma.module.findUnique({
      where: { id: input.id },
    });
    if (!mod) throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });
    return mod;
  }),

  getByTrack: publicProcedure.input(z.object({ trackId: z.string() })).query(async ({ ctx, input }) => {
    const modules = await ctx.prisma.module.findMany({
      where: { trackId: input.trackId },
      orderBy: { order: "asc" },
    });
    return modules;
  }),

  submitDecode: protectedProcedure
    .input(
      z.object({
        moduleId: z.string(),
        code: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch module content for comparison
      const mod = await ctx.prisma.module.findUnique({
        where: { id: input.moduleId },
      });
      if (!mod) throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });

      // Check for existing pending submission
      const existingPending = await ctx.prisma.submission.findFirst({
        where: { userId: ctx.session.user.id, moduleId: input.moduleId, status: "pending" },
      });
      if (existingPending) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have a pending submission for this module. Please wait for it to be scored." });
      }

      // Create a submission with pending status
      const submission = await ctx.prisma.submission.create({
        data: {
          userId: ctx.session.user.id,
          moduleId: input.moduleId,
          code: input.code,
          status: "pending",
        },
      });

      // Grade inline — serverless deployments have no background worker.
      let status = submission.status;
      try {
        const updated = await gradeSubmission(ctx.prisma, {
          submissionId: submission.id,
          userId: ctx.session.user.id,
          moduleId: input.moduleId,
          code: input.code,
          originalCode: mod.content,
        });
        status = updated.status;
      } catch (err) {
        logger.error({ err, submissionId: submission.id }, "Inline grading failed");
      }

      return { submissionId: submission.id, status };
    }),

  getProgress: protectedProcedure.input(z.object({ moduleId: z.string() })).query(async ({ ctx, input }) => {
    const submissions = await ctx.prisma.submission.findMany({
      where: { userId: ctx.session.user.id, moduleId: input.moduleId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    return {
      hasStarted: submissions.length > 0,
      latestSubmission: submissions[0] ?? null,
    };
  }),
});
