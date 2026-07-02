"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { TRPCProvider } from "@/lib/trpc/provider";
import { useAuthStore } from "@/stores/auth-store";
import { SessionSync } from "@/components/app/session-sync";

function SessionRestorer({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>
        <SessionRestorer>
          {children}
          <SessionSync />
        </SessionRestorer>
      </TRPCProvider>
    </SessionProvider>
  );
}
