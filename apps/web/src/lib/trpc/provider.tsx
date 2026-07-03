"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "./client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't retry 401 errors — redirect immediately
            retry: (failureCount, error) => {
              if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      }),
  );

  // Use relative URL so requests go through Next.js rewrites (/trpc -> localhost:3001).
  // This keeps requests same-origin, enabling httpOnly cookies for session auth.
  // Falls back to NEXT_PUBLIC_API_URL if set (e.g. direct API access).
  const trpcUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/trpc`
    : "/trpc";

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        // Custom 401 handling link — intercepts UNAUTHORIZED errors app-wide
        () => {
          return ({ op, next }) => {
            const observable = next(op);
            observable.subscribe({
              error(error) {
                if (error.data?.code === "UNAUTHORIZED") {
                  queueMicrotask(() => {
                    router.push("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname));
                  });
                }
              },
            });
            return observable;
          };
        },
        httpBatchLink({
          url: trpcUrl,
          // No Authorization header — session is in httpOnly cookie (same-origin via proxy).
          // When NEXT_PUBLIC_API_URL is set for direct access, the API's extractSessionToken
          // falls back to reading the cookie or Authorization header.
          fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
