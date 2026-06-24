FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY services/averi-memory-service/package.json services/averi-memory-service/
COPY packages/memory/package.json packages/memory/
COPY packages/cle-core/package.json packages/cle-core/
COPY packages/config/package.json packages/config/
COPY packages/engine-core/package.json packages/engine-core/

# Install only averi-memory-service and its deps
RUN pnpm install --frozen-lockfile --shamefully-hoist --ignore-scripts \
    --filter @cle/averi-memory-service... \
    --filter @cle/memory \
    --filter @cle/core \
    --filter @cle/config \
    --filter @cle/engine-core

RUN pnpm rebuild --recursive better-sqlite3 esbuild

# Copy source
COPY services/averi-memory-service/ services/averi-memory-service/
COPY packages/memory/ packages/memory/
COPY packages/cle-core/ packages/cle-core/
COPY packages/config/ packages/config/
COPY packages/engine-core/ packages/engine-core/

WORKDIR /app
RUN pnpm run --filter @cle/core build
RUN pnpm run --filter @cle/averi-memory-service build

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:3030/health || exit 1

WORKDIR /app/services/averi-memory-service
CMD ["node", "dist/services/averi-memory-service/src/index.js"]
