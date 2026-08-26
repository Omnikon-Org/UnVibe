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

  // Hit this app's own /api/trpc route handler so the httpOnly session
  // cookie rides along — no cross-origin calls, no tokens in localStorage.
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
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
        httpBatchLink({ url: "/api/trpc" }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
