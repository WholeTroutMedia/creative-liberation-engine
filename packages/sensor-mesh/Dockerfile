FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy all package.json files safely using wildcards
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json* ./
COPY packages/sensor-mesh/package.json packages/sensor-mesh/

# Only install the ones actually needed for sensor-mesh
RUN pnpm install --no-frozen-lockfile --shamefully-hoist \
    --filter @cle/sensor-mesh... || true

# Copy source safely
COPY packages/sensor-mesh/ packages/sensor-mesh/

WORKDIR /app/packages/sensor-mesh
RUN rm -f tsconfig.tsbuildinfo && CI=true PNPM_SKIP_STATUS_CHECK=true pnpm run build

ENV NODE_ENV=production
ENV PORT=5080

EXPOSE 5080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:5080/health || exit 1

CMD ["node", "dist/run-webhook.js"]
