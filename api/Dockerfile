# syntax=docker/dockerfile:1.7

# --- Base deps for building ---
FROM node:20-alpine AS builder
WORKDIR /app

# Enable corepack to use pnpm
RUN corepack enable

# Install dependencies (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build


# --- Production runtime image ---
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Enable corepack and install production dependencies only
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]


