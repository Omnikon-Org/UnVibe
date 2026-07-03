"use client";

import { create } from "zustand";
import { signOut as nextAuthSignOut } from "next-auth/react";

// SECURITY: Session tokens are now stored in httpOnly, SameSite=Strict cookies
// via the API (set by signIn/signUp/linkOAuth responses). Next.js rewrites in
// next.config.mjs proxy /trpc and /socket.io to the API, making cookies
// same-origin. This eliminates the XSS vector (previously WR-07).
//
// localStorage still caches user profile data for fast initial render, but
// never stores the raw sessionToken. The token is only in the httpOnly cookie.

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AuthStore {
  user: UserData | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  checkSession: () => Promise<void>;
  restoreSession: () => void;
}

// Use relative path so requests go through Next.js rewrites (same-origin,
// enabling httpOnly cookies). Falls back to direct API URL if set.
const API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/trpc` : "/trpc";
const SESSION_CACHE_KEY = "unvibe_user_cache";

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,

  restoreSession: () => {
    try {
      const stored = localStorage.getItem(SESSION_CACHE_KEY);
      if (stored) {
        set({ user: JSON.parse(stored), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  checkSession: async () => {
    try {
      // Cookies are sent automatically for same-origin requests (via proxy).
      // No Authorization header needed — the API reads the httpOnly cookie.
      const res = await fetch(`${API_URL}/auth.getSession`);
      const json = await res.json();
      if (json?.result?.data?.user) {
        const userData: UserData = {
          id: json.result.data.user.id,
          name: json.result.data.user.name ?? null,
          email: json.result.data.user.email ?? null,
          image: json.result.data.user.image ?? null,
        };
        set({ user: userData });
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(userData));
      } else {
        set({ user: null });
        localStorage.removeItem(SESSION_CACHE_KEY);
      }
    } catch {
      set({ user: null });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth.signIn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ "0": { email, password } }),
      });
      const json = await res.json();
      if (json?.result?.data?.user) {
        // Session token is set as httpOnly cookie by the API — no need to store it
        const userData: UserData = {
          id: json.result.data.user.id,
          name: json.result.data.user.name ?? null,
          email: json.result.data.user.email ?? null,
          image: json.result.data.user.image ?? null,
        };
        set({ user: userData });
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(userData));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  signUp: async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth.signUp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ "0": { name, email, password } }),
      });
      const json = await res.json();
      if (json?.result?.data?.user) {
        // Session token is set as httpOnly cookie by the API
        const userData: UserData = {
          id: json.result.data.user.id,
          name: json.result.data.user.name ?? null,
          email: json.result.data.user.email ?? null,
          image: json.result.data.user.image ?? null,
        };
        set({ user: userData });
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(userData));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  signOut: async () => {
    try {
      // Cookie is sent automatically for same-origin requests
      await fetch(`${API_URL}/auth.signOut`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Graceful — always clear local state
    }
    set({ user: null });
    localStorage.removeItem(SESSION_CACHE_KEY);
    // Also clear the NextAuth session cookie (OAuth users)
    await nextAuthSignOut({ redirect: false });
  },
}));
