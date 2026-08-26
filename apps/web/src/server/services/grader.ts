/**
 * Inline submission grader.
 *
 * Replaces the former BullMQ worker: on a serverless deployment there is no
 * long-running worker process, so submissions are graded within the mutation
 * itself. Grading is fast — diffCode is local text-similarity scoring, plus a
 * few Prisma writes — so this adds negligible latency over queueing.
 */

import type { PrismaClient, Submission } from "@prisma/client";
import pino from "pino";
import { aiClient } from "./ai-client";
import { calculateIRS } from "./irs-engine";

const logger = pino({ name: "grader" });

export interface SubmissionGradeInput {
  submissionId: string;
  userId: string;
  moduleId: string;
  code: string;
  originalCode: string;
  language?: string;
}

export async function gradeSubmission(
  prisma: PrismaClient,
  input: SubmissionGradeInput,
): Promise<Submission> {
  try {
    // 1. Score the rebuild against the original
    const diffResult = await aiClient.diffCode({
      originalCode: input.originalCode,
      updatedCode: input.code,
      language: input.language ?? "python",
    });

    // 2. Persist score + feedback
    const updated = await prisma.submission.update({
      where: { id: input.submissionId },
      data: {
        status: "scored",
        feedback: JSON.stringify({
          overallScore: diffResult.overallScore,
          dimensions: diffResult.dimensions,
          summary: diffResult.summary,
        }),
      },
    });

    // 3. Recalculate the user's IRS
    await triggerIRSRecalculation(prisma, input.userId);

    // 4. Schedule a Defend session
    await scheduleDefendSession(prisma, input.submissionId, input.userId, input.moduleId);

    return updated;
  } catch (err) {
    logger.error({ err, submissionId: input.submissionId }, "Submission processing failed");

    // Mark submission as failed so it doesn't sit pending forever
    await prisma.submission
      .update({
        where: { id: input.submissionId },
        data: { status: "failed" },
      })
      .catch((e: unknown) => logger.error({ err: e }, "Failed to update submission status"));

    throw err;
  }
}

async function triggerIRSRecalculation(prisma: PrismaClient, userId: string): Promise<void> {
  const result = await calculateIRS(prisma, userId);
  await prisma.iRSScore.create({
    data: { userId, score: result.score, details: result.details },
  });
  logger.info({ userId, averageScore: result.score }, "IRS score recalculated");
}

async function scheduleDefendSession(
  prisma: PrismaClient,
  submissionId: string,
  userId: string,
  moduleId: string,
): Promise<boolean> {
  try {
    // Check if a defend session already exists for this (user, module) pair
    const existing = await prisma.defendSession.findFirst({
      where: { userId, moduleId, status: { notIn: ["completed", "expired"] } },
    });

    if (existing) {
      logger.info({ userId, moduleId }, "Active defend session already exists — skipping");
      return false;
    }

    await prisma.defendSession.create({
      data: {
        userId,
        moduleId,
        status: "pending",
        conversation: [],
      },
    });

    logger.info({ userId, moduleId, submissionId }, "Defend session scheduled");
    return true;
  } catch (err) {
    // Handle race condition gracefully
    logger.warn({ err, userId, moduleId }, "Failed to schedule defend session (may be duplicate)");
    return false;
  }
}
