import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in development and across
// invocations in production serverless runtimes.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
