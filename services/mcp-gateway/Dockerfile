FROM node:20-alpine
WORKDIR /app
COPY services/mcp-gateway/package.json ./
RUN npm install
COPY services/mcp-gateway/ ./
RUN npx tsc
EXPOSE 5057
ENV MCP_GATEWAY_PORT=5057
CMD ["node", "dist/index.js"]

