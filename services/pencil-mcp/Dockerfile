FROM node:20-slim

WORKDIR /app

RUN npm install -g @open-pencil/mcp

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# Patch the import error in Node 20+
RUN sed -i "s/import packageJson from '..\/package.json';/import packageJson from '..\/package.json' assert { type: 'json' };/g" /usr/local/lib/node_modules/@open-pencil/mcp/dist/server.js

# Patch the server to accept standard MCP SDK query parameter for session ID
RUN sed -i "s/const sessionId = c.req.header('mcp-session-id') ?? undefined;/const sessionId = c.req.header('mcp-session-id') ?? new URL(c.req.url).searchParams.get('sessionId') ?? undefined;/g" /usr/local/lib/node_modules/@open-pencil/mcp/dist/server.js

# We want to run the HTTP version to bridge with Creative Liberation Engine
EXPOSE 3101
ENV OPENPENCIL_MCP_ROOT=/designs
CMD socat TCP-LISTEN:3101,fork,bind=0.0.0.0 TCP:127.0.0.1:3100 & openpencil-mcp-http
