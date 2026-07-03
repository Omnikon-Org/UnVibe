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
  sessionToken: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  checkSession: () => Promise<void>;
  restoreSession: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/trpc`
  : "/trpc";

const SESSION_CACHE_KEY = "unvibe_user_cache";
const SESSION_TOKEN_KEY = "unvibe_session_token";

function authHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: true,
  sessionToken: null,

  restoreSession: () => {
    try {
      const stored = localStorage.getItem(SESSION_CACHE_KEY);
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (stored) {
        set({ user: JSON.parse(stored), sessionToken: token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  checkSession: async () => {
    const token = get().sessionToken ?? localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      set({ user: null, isLoading: false });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth.getSession`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.result?.data?.user) {
        const userData: UserData = {
          id: json.result.data.user.id,
          name: json.result.data.user.name ?? null,
          email: json.result.data.user.email ?? null,
          image: json.result.data.user.image ?? null,
        };
        set({ user: userData, sessionToken: token });
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(userData));
      } else {
        set({ user: null, sessionToken: null });
        localStorage.removeItem(SESSION_CACHE_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
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
        const { user, sessionToken } = json.result.data;
        const userData: UserData = {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
        };
        set({ user: userData, sessionToken });
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(userData));
        if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
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
        const { user, sessionToken } = json.result.data;
        const userData: UserData = {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
        };
        set({ user: userData, sessionToken });
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(userData));
        if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  signOut: async () => {
    const token = get().sessionToken;
    try {
      await fetch(`${API_URL}/auth.signOut`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Graceful — always clear local state
    }
    set({ user: null, sessionToken: null });
    localStorage.removeItem(SESSION_CACHE_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    await nextAuthSignOut({ redirect: false });
  },
}));
