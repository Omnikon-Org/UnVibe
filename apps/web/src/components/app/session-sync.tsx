"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/stores/auth-store";
import { trpc } from "@/lib/trpc/client";

/**
 * Bridges NextAuth OAuth sessions to the auth-store / API session system.
 *
 * After a user signs in via GitHub/Google, NextAuth sets a JWT cookie
 * and redirects to the dashboard. This component detects the NextAuth
 * session, creates a DB session via the tRPC API, and stores it in
 * the auth-store so all subsequent API calls work.
 *
 * Place this near the root of the app (inside the SessionProvider).
 */
export function SessionSync() {
  const { data: session, status } = useSession();
  const { user: authUser, signOut: clearLocal } = useAuthStore();
  const synced = useRef(false);

  const linkMutation = trpc.auth.linkOAuth.useMutation();

  useEffect(() => {
    if (synced.current) return;
    if (status !== "authenticated" || !session?.user) return;
    // Already have a local session — nothing to sync
    if (authUser) return;

    synced.current = true;

    const user = session.user;
    linkMutation.mutate(
      {
        id: user.id ?? "",
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
      },
      {
        onSuccess: (data) => {
          if (data?.sessionToken && data?.user) {
            const sessionData = {
              id: data.user.id,
              name: data.user.name ?? null,
              email: data.user.email ?? null,
              image: data.user.image ?? null,
              sessionToken: data.sessionToken,
            };
            useAuthStore.setState({ user: sessionData });
            localStorage.setItem("unvibe_session", JSON.stringify(sessionData));
          }
        },
        onError: () => {
          synced.current = false;
        },
      },
    );
  }, [status, session, authUser, linkMutation]);

  // If OAuth session has ended but local session still exists, clear it
  useEffect(() => {
    if (status === "unauthenticated" && authUser && !authUser.sessionToken?.startsWith("oauth_")) {
      clearLocal();
    }
  }, [status, authUser, clearLocal]);

  return null;
}
