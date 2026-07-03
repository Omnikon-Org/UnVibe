FROM node:20-alpine AS base
# OpenSSL required by Prisma at runtime
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app

# ── deps stage: install all dependencies ──
FROM base AS deps

# Copy all workspace manifests needed for resolution
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json

# Install dependencies (no-frozen to handle lockfile drift in monorepo)
RUN pnpm install --no-frozen-lockfile

# Generate Prisma client
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm --filter=api exec prisma generate

# Copy root tsconfig.base.json — needed by both types and api
COPY tsconfig.base.json ./

# Build @unvibe/types first (needed for api dependency)
COPY packages/types/tsconfig.json packages/types/tsconfig.json
COPY packages/types/src packages/types/src
RUN pnpm --filter=@unvibe/types build

# Build the API
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src
RUN pnpm --filter=api build

# ── runner stage: minimal production image ──
# WORKDIR at /app (repo root) so pnpm's store symlinks resolve correctly
FROM base AS runner
WORKDIR /app

# Copy compiled API output
COPY --from=deps /app/apps/api/dist ./apps/api/dist
# Copy Prisma schema + migrations for runtime
COPY --from=deps /app/apps/api/prisma ./apps/api/prisma
# Copy package.json for process metadata
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
# Copy the full pnpm virtual store + root node_modules (needed for symlink resolution)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
