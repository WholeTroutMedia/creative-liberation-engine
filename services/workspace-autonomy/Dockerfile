# ─── WORKSPACE AUTONOMY — SAM & SAR Service ──────────────────────────────
# Creative Liberation Engine V6 | Port 5091
FROM node:22-alpine AS builder
ENV CI=true

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY services/workspace-autonomy/package.json services/workspace-autonomy/
COPY services/workspace-autonomy/tsconfig.json services/workspace-autonomy/

# Install dependencies
RUN pnpm install --frozen-lockfile --shamefully-hoist --ignore-scripts \
    --filter @cle/workspace-autonomy...

# Copy source code
COPY services/workspace-autonomy/src/ services/workspace-autonomy/src/

# Compile TypeScript
RUN pnpm run --filter @cle/workspace-autonomy build

FROM node:22-alpine AS runner
WORKDIR /app
ENV CI=true

# Install pnpm in runner
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/services/workspace-autonomy/package.json ./services/workspace-autonomy/
COPY --from=builder /app/services/workspace-autonomy/build/ ./services/workspace-autonomy/build/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile --shamefully-hoist --ignore-scripts \
    --filter @cle/workspace-autonomy...

EXPOSE 5091
ENV PORT=5091
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5091/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

WORKDIR /app/services/workspace-autonomy
CMD ["node", "build/server.js"]
