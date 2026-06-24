# ─── GENKIT — AI Orchestration Server ──────────────────────────────────────────
# Creative Liberation Engine V6 | Port 4000
# Self-contained build — zero V5 dependency
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache curl

WORKDIR /app

# ── Workspace root ─────────────────────────────────────────────────────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# ── Package manifests (cached layer) ──────────────────────────────────────────
COPY genkit/package.json              genkit/
COPY packages/auth/package.json            packages/auth/
COPY packages/claude-agent/package.json    packages/claude-agent/
COPY packages/compose-hardener/package.json packages/compose-hardener/
COPY packages/genmedia/package.json        packages/genmedia/
COPY packages/cle-core/package.json  packages/cle-core/
COPY packages/mcp-router/package.json      packages/mcp-router/
COPY packages/memory/package.json          packages/memory/
COPY packages/ouroboros/package.json       packages/ouroboros/
COPY packages/social/package.json          packages/social/
COPY packages/somatic/package.json         packages/somatic/
COPY packages/sensor-mesh/package.json     packages/sensor-mesh/
COPY packages/spatial-codex/package.json   packages/spatial-codex/
COPY packages/toolbox/package.json         packages/toolbox/
COPY packages/zero-day/package.json        packages/zero-day/
COPY packages/agent-spawner/package.json   packages/agent-spawner/
COPY packages/skills/package.json          packages/skills/

RUN pnpm install --frozen-lockfile --shamefully-hoist

# ── Source code ────────────────────────────────────────────────────────────────
COPY genkit/              genkit/
COPY packages/auth/            packages/auth/
COPY packages/claude-agent/    packages/claude-agent/
COPY packages/compose-hardener/ packages/compose-hardener/
COPY packages/genmedia/        packages/genmedia/
COPY packages/cle-core/  packages/cle-core/
COPY packages/mcp-router/      packages/mcp-router/
COPY packages/memory/          packages/memory/
COPY packages/ouroboros/       packages/ouroboros/
COPY packages/social/          packages/social/
COPY packages/somatic/         packages/somatic/
COPY packages/sensor-mesh/     packages/sensor-mesh/
COPY packages/spatial-codex/   packages/spatial-codex/
COPY packages/toolbox/         packages/toolbox/
COPY packages/zero-day/        packages/zero-day/
COPY packages/agent-spawner/   packages/agent-spawner/
COPY packages/skills/          packages/skills/

# ── Build workspace deps in topological order ──────────────────────────────────
RUN set -e \
 && pnpm --filter "@cle/auth"             run build \
 && pnpm --filter "@cle/claude-agent"     run build \
 && pnpm --filter "@cle/compose-hardener" run build \
 && pnpm --filter "@cle/core"             run build \
 && pnpm --filter "@cle/memory"           run build \
 && pnpm --filter "@cle/mcp-router"       run build \
 && pnpm --filter "@cle/ouroboros"        run build \
 && pnpm --filter "@cle/spatial-codex"    run build \
 && pnpm --filter "@cle/toolbox"          run build \
 && pnpm --filter "@cle/sensor-mesh"      run build \
 && pnpm --filter "@cle/skills"    run build

RUN pnpm --filter "@cle/agent-spawner" run build
RUN pnpm --filter "@cle/genkit" run build
RUN test -f genkit/dist/server.js \
 || (echo "ERROR: genkit/dist/server.js was not produced" && exit 1)
RUN pnpm --filter "@cle/zero-day" run build

# ── Runtime ────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:4000/health || exit 1

WORKDIR /app/genkit
CMD ["node", "dist/server.js"]
