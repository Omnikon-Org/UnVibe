import type { PrismaClient } from "@prisma/client";

export const SESSION_COOKIE_NAME = "unvibe_session_token";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// Session shape — only the fields the app needs from User
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
// CookieJar
//
// tRPC procedures run inside the fetch adapter, which owns the Response.
// Procedures queue cookies here; the route handler appends them to the
// response headers once the RPC completes. This replaces Express's
// res.cookie(...) while keeping httpOnly, SameSite=Strict semantics.
// ---------------------------------------------------------------------------
export class CookieJar {
  private cookies: string[] = [];

  setSessionCookie(token: string): void {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    this.cookies.push(
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Strict${secure}`,
    );
  }

  clearSessionCookie(): void {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    this.cookies.push(
      `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`,
    );
  }

  serialize(): string[] {
    return this.cookies;
  }
}

// ---------------------------------------------------------------------------
// Token extraction
//
//   1. unvibe_session_token cookie     — httpOnly cookie (browser requests)
//   2. Authorization: Bearer <token>   — explicit header (external clients)
// ---------------------------------------------------------------------------
function extractSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");

  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Session validation
//
// Looks up the extracted token in the database.
// Returns null for missing, invalid, or expired sessions — never throws.
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

export interface Context {
  prisma: PrismaClient;
  session: Session | null;
  setSessionCookie(token: string): void;
  clearSessionCookie(): void;
}

export async function createContext(opts: {
  req: Request;
  prisma: PrismaClient;
  jar: CookieJar;
}): Promise<Context> {
  const token = extractSessionToken(opts.req);
  const session = await resolveSession(token, opts.prisma);

  return {
    prisma: opts.prisma,
    session,
    setSessionCookie: (token: string) => opts.jar.setSessionCookie(token),
    clearSessionCookie: () => opts.jar.clearSessionCookie(),
  };
}
