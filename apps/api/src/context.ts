import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import type { Server } from "socket.io";
import type { Queue } from "bullmq";

// ---------------------------------------------------------------------------
// Shared infrastructure dependencies injected at startup
// ---------------------------------------------------------------------------
export interface ContextDeps {
  prisma: PrismaClient;
  logger: Logger;
  io: Server;
  submissionQueue: Queue | null; // null when Redis is unavailable
}

// ---------------------------------------------------------------------------
// Session shape — only the fields the API needs from User
// ---------------------------------------------------------------------------
export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface Session {
  user: SessionUser;
  sessionToken: string;
}

// ---------------------------------------------------------------------------
// Cookie helpers for the UnVibe API session token
//
// When the web app proxies /trpc through Next.js rewrites, the API can set
// httpOnly, SameSite=Strict cookies instead of relying on localStorage.
// This eliminates the XSS vector (WR-07).
// ---------------------------------------------------------------------------
export const SESSION_COOKIE_NAME = "unvibe_session_token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Set the httpOnly session cookie on the Express response.
 * Safe to call even if `res` is undefined (e.g. in test contexts).
 */
export function setSessionCookie(res: Response | undefined, token: string): void {
  if (!res) return;
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000, // maxAge is in seconds for cookies
  });
}

/**
 * Clear the httpOnly session cookie on the Express response.
 */
export function clearSessionCookie(res: Response | undefined): void {
  if (!res) return;
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

// ---------------------------------------------------------------------------
// Token extraction
//
// This is the ONLY place that knows about transport conventions.
// To switch from Authorization header to cookie (or vice versa), change this
// function alone — nothing else in the auth stack needs to move.
//
// Current strategy (precedence order):
//   1. unvibe_session_token cookie          — httpOnly cookie (used via Next.js rewrites)
//   2. Authorization: Bearer <token>        — explicit header (Server Components, API clients)
//   3. authjs.session-token cookie          — forwarded Auth.js cookie (browser requests)
// ---------------------------------------------------------------------------
export function extractSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;

  // 1. UnVibe API session cookie (httpOnly, set by signIn/signUp/linkOAuth)
  if (cookieHeader) {
    const unvibeMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (unvibeMatch?.[1]) {
      return decodeURIComponent(unvibeMatch[1]);
    }
  }

  // 2. Bearer token header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  // 3. Auth.js session cookie (dev name; prod uses __Secure-authjs.session-token)
  if (cookieHeader) {
    const match =
      // production (Secure prefix)
      cookieHeader.match(/(?:^|;\s*)__Secure-authjs\.session-token=([^;]+)/) ??
      // development
      cookieHeader.match(/(?:^|;\s*)authjs\.session-token=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Session validation
//
// Looks up the extracted token in the database.
// Returns null for missing, invalid, or expired sessions — never throws.
// Callers (protectedProcedure) decide whether to error.
// ---------------------------------------------------------------------------
async function resolveSession(token: string | null, prisma: PrismaClient): Promise<Session | null> {
  if (!token) return null;

  const dbSession = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!dbSession || dbSession.expires <= new Date()) return null;

  return { user: dbSession.user, sessionToken: dbSession.sessionToken };
}

// ---------------------------------------------------------------------------
// createContext — called per request by the tRPC Express adapter
// ---------------------------------------------------------------------------
export async function createContext({ req, res }: { req: Request; res: Response }, deps: ContextDeps): Promise<Context> {
  const token = extractSessionToken(req);
  const session = await resolveSession(token, deps.prisma);

  return {
    prisma: deps.prisma,
    logger: deps.logger,
    io: deps.io,
    submissionQueue: deps.submissionQueue,
    res,
    session,
  };
}

export type Context = ContextDeps & { res: Response; session: Session | null };
