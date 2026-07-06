import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Allow through if NextAuth session exists (OAuth users)
  if (req.auth) return;

  // Allow through if custom API session cookie exists (email/password users)
  // Actual cookie validation happens server-side via tRPC protectedProcedure
  if (req.cookies.has("unvibe_session_token")) return;

  // Redirect to sign-in only if NO session evidence exists at all
  if (req.nextUrl.pathname.startsWith("/app")) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
