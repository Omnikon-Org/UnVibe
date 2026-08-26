import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function createSessionExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
}

/**
 * Shape returned over the wire. Never return raw Prisma User rows —
 * they carry passwordHash.
 */
interface PublicUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

function publicUser(user: {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}): PublicUser {
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

export const authRouter = router({
  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      const sessionToken = generateSessionToken();
      await ctx.prisma.session.create({
        data: {
          sessionToken,
          userId: user.id,
          expires: createSessionExpiry(),
        },
      });

      // Set httpOnly session cookie via the response cookie jar
      ctx.setSessionCookie(sessionToken);

      return { user: publicUser(user) };
    }),

  signUp: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await ctx.prisma.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });

      const sessionToken = generateSessionToken();
      await ctx.prisma.session.create({
        data: {
          sessionToken,
          userId: user.id,
          expires: createSessionExpiry(),
        },
      });

      // Set httpOnly session cookie via the response cookie jar
      ctx.setSessionCookie(sessionToken);

      return { user: publicUser(user) };
    }),

  /**
   * Creates a DB session for an OAuth-authenticated user.
   * Called by the web app after NextAuth OAuth completes,
   * bridging the NextAuth JWT session to the app's DB session system.
   *
   * REQUIRES a signed proof token issued by /api/auth/issue-link-token.
   * Without that requirement this endpoint would let anyone mint a session
   * for any known email or provider id.
   */
  linkOAuth: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().nullable(),
        email: z.string().email().nullable(),
        image: z.string().nullable(),
        nextAuthProof: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const secret = process.env.NEXTAUTH_SECRET || "";
      if (!secret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Auth not configured" });
      }

      const parts = input.nextAuthProof.split(".");
      if (parts.length !== 2) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid auth proof" });
      const decodedPayload = Buffer.from(parts[0], "base64").toString();

      const expectedSig = createHmac("sha256", secret).update(decodedPayload).digest("hex");
      const signatureBuf = Buffer.from(parts[1], "utf8");
      const expectedBuf = Buffer.from(expectedSig, "utf8");
      if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid auth proof signature" });
      }

      let proof: { sub?: string; email?: string | null; exp?: number };
      try {
        proof = JSON.parse(decodedPayload);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Malformed auth proof" });
      }
      if (typeof proof.exp !== "number" || proof.exp < Math.floor(Date.now() / 1000)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Auth proof expired" });
      }
      // The proof must bind BOTH the provider id and the email being claimed,
      // otherwise a valid proof for account A could be replayed against B's row.
      if (proof.sub !== input.id || (proof.email ?? null) !== input.email) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Proof does not match submitted identity" });
      }

      // Identity is now verified. Find or create the user; the email lookup
      // intentionally links OAuth sign-in onto an existing password account.
      let user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
      });

      if (!user && input.email) {
        user = await ctx.prisma.user.findUnique({
          where: { email: input.email },
        });
      }

      if (!user) {
        user = await ctx.prisma.user.create({
          data: {
            id: input.id,
            name: input.name,
            email: input.email,
            image: input.image,
          },
        });
      }

      const sessionToken = generateSessionToken();
      await ctx.prisma.session.create({
        data: {
          sessionToken,
          userId: user.id,
          expires: createSessionExpiry(),
        },
      });

      // Set httpOnly session cookie via the response cookie jar
      ctx.setSessionCookie(sessionToken);

      return { user: publicUser(user) };
    }),

  getSession: protectedProcedure.query(({ ctx }) => {
    return { user: ctx.session.user };
  }),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.session.sessionToken) {
      await ctx.prisma.session.delete({
        where: { sessionToken: ctx.session.sessionToken },
      });
    }
    // Clear the httpOnly session cookie
    ctx.clearSessionCookie();
    return { success: true };
  }),
});
