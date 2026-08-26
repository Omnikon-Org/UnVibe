"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/stores/auth-store";
import { trpc } from "@/lib/trpc/client";

const USER_CACHE_KEY = "unvibe_user_cache";

/**
 * Bridges NextAuth OAuth sessions to the auth-store / API session system.
 *
 * After a user signs in via GitHub/Google, NextAuth sets a JWT cookie
 * and redirects to the dashboard. This component detects the NextAuth
 * session, creates a DB session via the tRPC API (which sets an httpOnly
 * cookie), and caches user profile data in the auth-store.
 *
 * Tokens never touch localStorage — they live only in cookies. User
 * profile data is cached in localStorage for fast initial render
 * (not sensitive — no token).
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

    // linkOAuth rejects unsigned identities — always fetch a fresh proof
    async function performLink() {
      let nextAuthProof: string;
      try {
        const proofRes = await fetch("/api/auth/issue-link-token", { method: "POST" });
        if (!proofRes.ok) throw new Error(`proof request failed (${proofRes.status})`);
        const proofData = await proofRes.json();
        nextAuthProof = proofData.token;
      } catch {
        synced.current = false;
        return;
      }

      linkMutation.mutate(
        {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          nextAuthProof,
        },
        {
          onSuccess: (data) => {
            if (data?.user) {
              const userData = {
                id: data.user.id,
                name: data.user.name ?? null,
                email: data.user.email ?? null,
                image: data.user.image ?? null,
              };
              useAuthStore.setState({ user: userData });
              localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
            }
          },
          onError: () => {
            synced.current = false;
          },
        },
      );
    }
    performLink();
  }, [status, session, authUser, linkMutation]);

  // If OAuth session has ended but local session still exists, clear it
  useEffect(() => {
    if (status === "unauthenticated" && authUser) {
      clearLocal();
      localStorage.removeItem(USER_CACHE_KEY);
    }
  }, [status, authUser, clearLocal]);

  return null;
}
