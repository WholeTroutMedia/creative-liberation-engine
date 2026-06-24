# ─── REASONING CORE — Chain-of-Thought Trace & Inference Orchestrator ──────────
# Creative Liberation Engine V6 | Port 5090
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy workspace root files for dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY services/reasoning-core/package.json services/reasoning-core/

# Install only reasoning-core and its dependencies
RUN pnpm install --frozen-lockfile --shamefully-hoist --ignore-scripts \
    --filter @cle/reasoning-core...

# Copy source
COPY services/reasoning-core/ services/reasoning-core/

# Build TypeScript
WORKDIR /app/services/reasoning-core
ENV CI=true
RUN pnpm run build

EXPOSE 5090

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:5090/health || exit 1

CMD ["node", "build/server.js"]
