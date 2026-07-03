import dotenv from "dotenv";
import { withSentryConfig } from "@sentry/nextjs";

// Load env vars from the root .env.local so both API and web read from the same file
dotenv.config({ path: "../../.env.local" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Proxy /trpc and /socket.io to the API server (port 3001).
  // This ensures same-origin requests, allowing httpOnly cookies for session tokens
  // instead of storing tokens in localStorage (mitigating XSS vector WR-07).
  async rewrites() {
    return [
      {
        source: "/trpc/:path*",
        destination: "http://localhost:3001/trpc/:path*",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3001/socket.io/:path*",
      },
    ];
  },
};

const isMockSentry = !process.env.SENTRY_DSN_WEB || process.env.SENTRY_DSN_WEB.includes("example");

export default withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: "unvibe",
    project: "web",
  },
  {
    widenClientSandbox: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
    disableServerWebpackPlugin: isMockSentry,
    disableClientWebpackPlugin: isMockSentry,
  }
);
