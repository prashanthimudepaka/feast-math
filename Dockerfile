# syntax=docker/dockerfile:1

# ---- deps: full dependency tree (dev deps included: build + migrate need them) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the standalone Next.js server ----
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders only: module-level code reads these at import during
# "collecting page data", but nothing connects at build time (every page
# is dynamic). Real values come from the runtime environment.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder
RUN npm run build

# ---- migrate: one-shot drizzle-kit migration runner (compose runs it before app) ----
FROM node:24-alpine AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY lib/db ./lib/db
CMD ["npm", "run", "db:migrate"]

# ---- run: minimal production image, no node_modules ----
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
