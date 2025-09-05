# syntax=docker/dockerfile:1.7

# --- Base deps for building ---
FROM node:20-alpine AS builder
WORKDIR /repo

# Enable corepack and pin pnpm version
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Install dependencies for the API workspace using the root lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY api/package.json ./api/package.json
RUN pnpm install --frozen-lockfile --filter api

# Copy source and build only the API
COPY api/tsconfig.json ./api/tsconfig.json
COPY api/src ./api/src
RUN pnpm -C api build

# Prune dev dependencies to keep only production deps for the runtime image
RUN pnpm -C api prune --prod


# --- Production runtime image ---
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy production node_modules from builder to avoid re-install
COPY --from=builder /repo/api/node_modules ./node_modules

# Copy compiled output from builder
COPY --from=builder /repo/api/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]


