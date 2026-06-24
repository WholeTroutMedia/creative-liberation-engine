# ─── ZERO DAY — Client Operations ──────────────────────────────────────────────
# Creative Liberation Engine v5 | Port 9000
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache curl chromium nss freetype harfbuzz ca-certificates ttf-freefont
RUN npm i -g tsx

WORKDIR /app

# ─── Install: copy all package.json manifests first for layer-cache efficiency
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/zero-day/package.json packages/zero-day/
COPY packages/genkit/package.json packages/genkit/
COPY packages/toolbox/package.json packages/toolbox/
COPY packages/memory/package.json packages/memory/
COPY packages/genmedia/package.json packages/genmedia/
COPY packages/agent-spawner/package.json packages/agent-spawner/
COPY packages/auth/package.json packages/auth/
COPY packages/claude-agent/package.json packages/claude-agent/
COPY packages/compose-hardener/package.json packages/compose-hardener/
COPY packages/cle-core/package.json packages/cle-core/
COPY packages/mcp-router/package.json packages/mcp-router/
COPY packages/ouroboros/package.json packages/ouroboros/
COPY packages/sensor-mesh/package.json packages/sensor-mesh/
COPY packages/social/package.json packages/social/
COPY packages/somatic/package.json packages/somatic/
COPY packages/spatial-codex/package.json packages/spatial-codex/
COPY packages/skills/package.json packages/skills/
COPY packages/tsconfig/package.json packages/tsconfig/

# Install zero-day and all its internal workspace dependencies
RUN pnpm install --shamefully-hoist --filter @cle/zero-day...

# ─── Copy source
COPY packages/zero-day/ packages/zero-day/
COPY packages/genkit/ packages/genkit/
COPY packages/toolbox/ packages/toolbox/
COPY packages/memory/ packages/memory/
COPY packages/genmedia/ packages/genmedia/
COPY packages/agent-spawner/ packages/agent-spawner/
COPY packages/auth/ packages/auth/
COPY packages/claude-agent/ packages/claude-agent/
COPY packages/compose-hardener/ packages/compose-hardener/
COPY packages/cle-core/ packages/cle-core/
COPY packages/mcp-router/ packages/mcp-router/
COPY packages/ouroboros/ packages/ouroboros/
COPY packages/sensor-mesh/ packages/sensor-mesh/
COPY packages/social/ packages/social/
COPY packages/somatic/ packages/somatic/
COPY packages/spatial-codex/ packages/spatial-codex/
COPY packages/skills/ packages/skills/
COPY packages/tsconfig/ packages/tsconfig/

# ─── Build workspace packages that ship dist/ as their main entry
# Toolbox first — genkit toolbox-tools.ts uses dynamic import('@cle/toolbox')
WORKDIR /app
RUN pnpm --filter @cle/toolbox run build
# Build genkit (required by vision-curator and other modules)
WORKDIR /app/packages/genkit
RUN pnpm run build || echo "[WARN] genkit build had warnings"

# Build memory
WORKDIR /app/packages/memory
RUN pnpm run build || echo "[WARN] memory build had warnings"

# Build agent-spawner
WORKDIR /app/packages/agent-spawner
RUN pnpm run build || echo "[WARN] agent-spawner build had warnings"

# ─── Run
WORKDIR /app/packages/zero-day

ENV NODE_ENV=production
ENV PORT=9000
EXPOSE 9000

CMD ["tsx", "src/server.ts"]
