FROM node:20-alpine

WORKDIR /app

# Copy root package/lock
COPY package.json pnpm-lock.yaml ./

# We only need the synology-media-mcp code
COPY services/synology-media-mcp ./services/synology-media-mcp

# Install dependencies globally via corepack
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# Install production deps
RUN pnpm install --filter=@cle/synology-media-mcp --prod

# Expose as a command if needed, but MCP usually runs over stdio or SSE.
# If running as stdio via docker, we'd need to use it differently.
# But for now, we'll just run it with node
CMD ["node", "services/synology-media-mcp/src/index.mjs"]
