# ─── GENKIT — AI Orchestration Server ──────────────────────────────────────────
# Creative Liberation Engine v5 | Port 4000
#
# Root cause of crash: workspace deps (mcp-router, toolbox, ouroboros, etc.) had
# no dist/ in the image. Fixed by: copying all required workspace packages +
# building them to dist/ in topological order before building genkit itself.
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk add --no-cache curl

WORKDIR /app
ENV CI=true
ENV NODE_OPTIONS="--max-old-space-size=1536"

# ── Workspace root ─────────────────────────────────────────────────────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# ── Package manifests (cached layer — only invalidates when package.json changes) ─
COPY packages/genkit/package.json          packages/genkit/
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
COPY packages/tsconfig/package.json        packages/tsconfig/
COPY packages/config/package.json          packages/config/
COPY packages/engine-core/package.json     packages/engine-core/
COPY packages/inference-router/package.json packages/inference-router/
COPY packages/spatial-intelligence/package.json packages/spatial-intelligence/

RUN pnpm install --no-frozen-lockfile --shamefully-hoist

# ── Source code ────────────────────────────────────────────────────────────────
RUN echo "cachebust-gemini-v7"
COPY packages/genkit/          packages/genkit/
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
COPY packages/tsconfig/        packages/tsconfig/
COPY packages/config/          packages/config/
COPY packages/engine-core/     packages/engine-core/
COPY packages/inference-router/ packages/inference-router/
COPY packages/spatial-intelligence/   packages/spatial-intelligence/

# ── Copy Context Files ────────────────────────────────────────────────────────
COPY AGENTS.md ./
COPY docs/ docs/

# ── Build workspace deps in topological order ──────────────────────────────────
# Phase 1: Leaf packages — no workspace:* deps, build in parallel would work but
#          sequential keeps the log readable and the layer clean.
RUN set -e \
 && pnpm --filter "@cle/auth"             run build \
 && pnpm --filter "@cle/claude-agent"     run build \
 && pnpm --filter "@cle/compose-hardener" run build \
 && pnpm --filter "@cle/config"           run build \
 && pnpm --filter "@cle/engine-core"      run build \
 && pnpm --filter "@cle/core"             run build \
 && pnpm --filter "@cle/memory"           run build \
 && pnpm --filter "@cle/mcp-router"       run build \
 && pnpm --filter "@cle/ouroboros"        run build \
 && pnpm --filter "@cle/spatial-codex"    run build \
 && pnpm --filter "@cle/spatial-intelligence" run build \
 && pnpm --filter "@cle/toolbox"          run build \
 && pnpm --filter "@cle/sensor-mesh"      run build \
 && pnpm --filter "@cle/inference-router" run build \
 && pnpm --filter "@cle/skills"    run build

# Phase 2: agent-spawner (depends on skills)
RUN pnpm --filter "@cle/agent-spawner" run build

# Phase 3: genkit (zero-day depends on genkit — genkit must build first)
RUN pnpm --filter "@cle/genkit" run build
RUN test -f packages/genkit/dist/server.js \
 || (echo "ERROR: genkit/dist/server.js was not produced" && exit 1)

# Phase 4: zero-day (optional co-located service in this image)
RUN pnpm --filter "@cle/zero-day" run build
RUN test -f packages/zero-day/dist/index.js \
 || (echo "ERROR: zero-day/dist/index.js was not produced — build truly failed" && exit 1)

# ── Runtime ────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:4000/health || exit 1

WORKDIR /app/packages/genkit
CMD ["node", "dist/server.js"]
