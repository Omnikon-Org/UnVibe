import dotenv from "dotenv";

// Load env vars from the root .env.local for local development
dotenv.config({ path: "../../.env.local" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The tRPC API lives in this same app at /api/trpc (see src/app/api/trpc).
  // Browser code always calls it same-origin, which keeps session cookies
  // httpOnly — there is no separate backend deployment to proxy to.
};

export default nextConfig;
