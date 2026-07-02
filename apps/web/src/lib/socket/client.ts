"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    // Socket.io connects directly to the API. The httpOnly session cookie is
    // sent with the WebSocket upgrade request because credentials: true is set.
    // When behind Next.js rewrites (production), the WebSocket upgrade should
    // go through the proxy path; for direct dev access, use the full URL.
    socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001", {
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
  }

  return socket;
}
