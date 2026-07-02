import { auth } from "@/auth";

export default auth((req) => {
  // Only protect /app/* routes — auth pages, API routes, and static files are open
  if (!req.auth && req.nextUrl.pathname.startsWith("/app")) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
