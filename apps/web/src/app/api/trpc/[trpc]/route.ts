import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";
import { createContext, CookieJar } from "@/server/context";
import { prisma } from "@/server/prisma";

// LLM-backed procedures can take tens of seconds on cold starts.
export const maxDuration = 60;

function handler(req: Request) {
  const jar = new CookieJar();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req, prisma, jar }),
  }).then((response) => {
    const cookies = jar.serialize();
    if (cookies.length === 0) return response;
    // Clone so we can append Set-Cookie headers queued up by procedures.
    const res = new Response(response.body, response);
    for (const cookie of cookies) {
      res.headers.append("set-cookie", cookie);
    }
    return res;
  });
}

export { handler as GET, handler as POST };
