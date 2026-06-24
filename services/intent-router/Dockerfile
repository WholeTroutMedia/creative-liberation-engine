# ─── INTENT ROUTER — Deterministic & Semantic Routing Service ──────────────────
# Creative Liberation Engine V6 | Port 5180
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy workspace root files for dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY services/intent-router/package.json services/intent-router/

# Install only intent-router and its dependencies
RUN pnpm install --frozen-lockfile --shamefully-hoist --ignore-scripts \
    --filter @cle/intent-router...

# Copy source
COPY services/intent-router/ services/intent-router/

# Build TypeScript
WORKDIR /app/services/intent-router
RUN pnpm run build

EXPOSE 5180

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:5180/api/status || exit 1

CMD ["node", "build/server.js"]
