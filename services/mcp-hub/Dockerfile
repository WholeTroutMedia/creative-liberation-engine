FROM node:20-alpine
WORKDIR /app
COPY services/mcp-hub/package.json ./
RUN npm install
COPY services/mcp-hub/ ./
RUN npx esbuild src/events.ts src/index.ts src/mcp-server.ts src/publishing-worker.ts src/rbac.ts src/routes.ts src/sprint-planner.ts src/vectorize.ts --platform=node --format=esm --outdir=dist
RUN npm prune --production
EXPOSE 5056
ENV MCP_HUB_PORT=5056
ENV MCP_HUB_DATA_DIR=/data
CMD ["node", "dist/index.js"]
