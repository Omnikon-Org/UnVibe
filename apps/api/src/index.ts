import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createServer } from "http";
import { Server } from "socket.io";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import net from "net";
import { createContext } from "./context";
import { createSubmissionWorker } from "./services/submission-worker";
import { appRouter, type AppRouter } from "./router";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

// Initialize Prisma
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Redis / BullMQ setup (resilient — works without Redis running)
// ---------------------------------------------------------------------------

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname || "localhost", port: parseInt(parsed.port) || 6379 };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}
const connectionOpts = parseRedisUrl(redisUrl);

/**
 * Quick TCP connectivity check — avoids BullMQ's infinite retry spam when
 * Redis is not available (e.g. Docker not running).
 */
function checkRedisReachable(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

let submissionQueue: Queue | null = null;
// declared here for scope; assigned inside initRedisDeps
let submissionWorker: ReturnType<typeof createSubmissionWorker> | null = null;

async function initRedisDeps(): Promise<void> {
  const available = await checkRedisReachable(connectionOpts.host, connectionOpts.port);

  if (!available) {
    logger.warn(
      "Redis unavailable — job queue and submission worker disabled. " +
        "Start Docker with: docker compose -f infra/docker-compose.yml up -d",
    );
    return;
  }

  try {
    submissionQueue = new Queue("submissions", {
      connection: connectionOpts,
    });
    await submissionQueue.waitUntilReady();

    submissionWorker = createSubmissionWorker(prisma, connectionOpts);

    logger.info("Redis connected — job queue and submission worker enabled");
  } catch (err) {
    logger.warn(
      { err },
      "Failed to initialize BullMQ — job queue and submission worker disabled. " +
        "Start Docker with: docker compose -f infra/docker-compose.yml up -d",
    );
    submissionQueue = null;
    submissionWorker = null;
  }
}

// Fire-and-forget: server starts immediately even if Redis init is pending
initRedisDeps().catch((err) => {
  logger.error({ err }, "Unexpected error during Redis initialization");
});

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
};

// Socket.io
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Client connected");
  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Client disconnected");
  });
});

app.use(cors(corsOptions));
app.use(express.json());

// tRPC express middleware
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: (opts) => createContext(opts, { prisma, logger, io, submissionQueue }),
  }),
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "api" });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info(`Express API server running on port ${PORT}`);
});
