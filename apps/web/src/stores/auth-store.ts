"use client";

import { create } from "zustand";
import { signOut as nextAuthSignOut } from "next-auth/react";

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

// Requests always go through the same-origin /trpc proxy so the httpOnly
// session cookie authenticates them — no session token is stored client-side.
const API_URL = "/trpc";

const SESSION_CACHE_KEY = "unvibe_user_cache";

export const useAuthStore = create<AuthStore>((set, get) => ({
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
    // Nothing to validate unless an earlier session cached a profile
    if (!get().user && !localStorage.getItem(SESSION_CACHE_KEY)) {
      set({ isLoading: false });
      return;
    }
    try {
      // The httpOnly cookie identifies the session — no Authorization header
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
        body: JSON.stringify({ "0": { email, password } }),
      });
      const json = await res.json();
      if (json?.result?.data?.user) {
        const user = json.result.data.user;
        const userData: UserData = {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
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
        body: JSON.stringify({ "0": { name, email, password } }),
      });
      const json = await res.json();
      if (json?.result?.data?.user) {
        const user = json.result.data.user;
        const userData: UserData = {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
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
      await fetch(`${API_URL}/auth.signOut`, { method: "POST" });
    } catch {
      // Graceful — always clear local state
    }
    set({ user: null });
    localStorage.removeItem(SESSION_CACHE_KEY);
    await nextAuthSignOut({ redirect: false });
  },
}));
