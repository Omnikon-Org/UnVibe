import dotenv from "dotenv";

// Load env vars from the root .env.local so both API and web read from the same file
dotenv.config({ path: "../../.env.local" });

// Origin of the backend API behind the same-origin /trpc and /socket.io proxies.
// Set API_ORIGIN in hosted environments (e.g. https://<render-service>.onrender.com);
// falls back to the local development API server.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Proxy /trpc and /socket.io to the API server.
  // This ensures same-origin requests, allowing httpOnly cookies for session tokens
  // instead of storing tokens in localStorage (mitigating XSS vector WR-07).
  async rewrites() {
    return [
      {
        source: "/trpc/:path*",
        destination: `${apiOrigin}/trpc/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${apiOrigin}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
