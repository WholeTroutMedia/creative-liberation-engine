# ─── DISPATCH — Task Queue & Orchestration Server ──────────────────────────────
# Creative Liberation Engine V6 | Port 5160
# Self-contained build — zero V5 dependency
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY services/dispatch/package.json services/dispatch/
COPY packages/memory/package.json packages/memory/
COPY packages/model-arbitrage/package.json packages/model-arbitrage/
COPY packages/cle-core/package.json packages/cle-core/
COPY packages/config/package.json packages/config/
COPY packages/engine-core/package.json packages/engine-core/
COPY packages/a2a-protocol/package.json packages/a2a-protocol/

# Install only dispatch and its deps
RUN pnpm install --frozen-lockfile --shamefully-hoist --ignore-scripts \
    --filter @cle/dispatch... \
    --filter @cle/memory \
    --filter @cle/core \
    --filter @cle/config \
    --filter @cle/engine-core \
    --filter @creative-liberation-engine/model-arbitrage \
    --filter @creative-liberation-engine/a2a-protocol

RUN pnpm rebuild better-sqlite3 esbuild

# Copy source
COPY services/dispatch/ services/dispatch/
COPY packages/memory/ packages/memory/
COPY packages/model-arbitrage/ packages/model-arbitrage/
COPY packages/cle-core/ packages/cle-core/
COPY packages/config/ packages/config/
COPY packages/engine-core/ packages/engine-core/
COPY packages/a2a-protocol/ packages/a2a-protocol/

WORKDIR /app
RUN pnpm run --filter @cle/core build
RUN pnpm run --filter @creative-liberation-engine/a2a-protocol build
RUN cd packages/a2a-protocol && npx tsc --showConfig
RUN ls -la packages/a2a-protocol/dist
RUN pnpm run --filter @cle/memory build
RUN pnpm run --filter @creative-liberation-engine/model-arbitrage build
RUN pnpm run --filter @cle/dispatch build

RUN mkdir -p /data
ENV DISPATCH_STORE_DIR=/data

EXPOSE 5160

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:5160/health || exit 1

WORKDIR /app/services/dispatch
CMD ["node", "build/server.js"]
