import { randomBytes, createHmac } from "node:crypto";
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

      return { user, sessionToken };
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

      return { user, sessionToken };
    }),

  /**
   * Creates a DB session for an OAuth-authenticated user.
   * Called by the web app after NextAuth OAuth completes,
   * bridging the OAuth session to the Express API's session system.
   */
  linkOAuth: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        image: z.string().nullable(),
        nextAuthProof: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify NextAuth proof token if provided
      if (input.nextAuthProof) {
        const parts = input.nextAuthProof.split(".");
        if (parts.length !== 2) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid auth proof" });
        const payload = parts[0];
        const signature = parts[1];
        const decodedPayload = Buffer.from(payload, "base64").toString();
        const expectedSig = createHmac("sha256", process.env.NEXTAUTH_SECRET || "").update(decodedPayload).digest("hex");
        if (signature !== expectedSig) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid auth proof signature" });
        const data = JSON.parse(decodedPayload);
        if (data.exp < Math.floor(Date.now() / 1000)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Auth proof expired" });
        if (data.sub !== input.id) throw new TRPCError({ code: "FORBIDDEN", message: "User ID mismatch" });
      }

      // Find or create the user from the OAuth provider data
      let user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        user = await ctx.prisma.user.findUnique({
          where: { email: input.email ?? undefined },
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

      return { user, sessionToken };
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
    return { success: true };
  }),
});
