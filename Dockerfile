FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Pin pnpm to v10 — v11 makes ignored-build-scripts fatal even when
# `pnpm.onlyBuiltDependencies` is set in package.json, breaking CI install.
RUN apk add --no-cache libc6-compat && npm install -g pnpm@10

WORKDIR /app

# Copy package manifests, build config, and ALL dialect templates so the
# postinstall hook can stamp out a matching schema.ts during install.
COPY package.json pnpm-lock.yaml* next.config.ts ./
COPY scripts/db-setup.mjs scripts/db-setup.mjs
COPY src/config/db/schema.sqlite.ts src/config/db/schema.sqlite.ts
COPY src/config/db/schema.postgres.ts src/config/db/schema.postgres.ts
COPY src/config/db/schema.mysql.ts src/config/db/schema.mysql.ts

# DATABASE_PROVIDER must be set at build time so prebuild / postinstall pick
# the matching schema template. Pass it via `docker build --build-arg
# DATABASE_PROVIDER=postgresql` or set in your CI / k8s build pipeline.
ARG DATABASE_PROVIDER=sqlite
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}

RUN pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM deps AS builder

WORKDIR /app

COPY . .
ENV DOCKER=1
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir .next && \
    chown nextjs:nodejs .next

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
