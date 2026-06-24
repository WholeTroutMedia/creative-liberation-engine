# ─── ANTIGRAVITY NAS — Autonomous AI Agent Instance ──────────────────────────
# Creative Liberation Engine v5 | Synology NAS Deployment
#
# Runs the Creative Liberation Engine AI agent in headless/autonomous mode connected to:
#   - Dispatch server for task polling
#   - Redis for Zero-Day pub/sub
#   - Local Docker socket (DinD) for infrastructure execution
#
# Constitutional: Article II (Sovereignty) — runs natively on NAS hardware

FROM node:22-alpine

# Install Docker CLI (for DinD — Docker socket is mounted at runtime)
RUN apk add --no-cache \
    curl \
    docker-cli \
    git \
    bash \
    openssh-client

RUN npm i -g tsx typescript

WORKDIR /app

# Install nas-watcher and its dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY packages/nas-watcher/package.json packages/nas-watcher/
RUN pnpm install --frozen-lockfile --shamefully-hoist --filter @cle/nas-watcher...

COPY packages/nas-watcher/ packages/nas-watcher/

# ── Environment ────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV DISPATCH_URL=http://127.0.0.1:5050
ENV REDIS_URL=redis://127.0.0.1:6379
ENV GENKIT_URL=http://genkit:4100

# Healthcheck: verify daemon can reach dispatch server
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -fs "${DISPATCH_URL}/api/status" | grep -q '"summary"' || exit 1

WORKDIR /app/packages/nas-watcher
CMD ["tsx", "src/daemon.ts"]
