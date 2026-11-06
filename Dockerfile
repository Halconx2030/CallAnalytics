# syntax=docker/dockerfile:1

# ---------- Etapa 1: dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY presentation/package.json ./presentation/
RUN pnpm install --frozen-lockfile --filter . --filter ./presentation

# ---------- Etapa 2: build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/presentation/node_modules ./presentation/node_modules
COPY . .
RUN pnpm build && pnpm --dir presentation build

# ---------- Etapa 3: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && addgroup -S app && adduser -S app -G app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY presentation/package.json ./presentation/
RUN pnpm install --frozen-lockfile --prod --filter . && pnpm store prune
COPY --from=build /app/dist ./dist
COPY --from=build /app/presentation/dist ./presentation/dist
USER app
EXPOSE 3000
CMD ["node", "dist/app.js"]
