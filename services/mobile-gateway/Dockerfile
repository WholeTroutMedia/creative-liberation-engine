FROM node:22-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy configuration files
COPY services/mobile-gateway/package.json ./services/mobile-gateway/
COPY services/mobile-gateway/tsconfig.json ./services/mobile-gateway/
COPY services/mobile-gateway/src ./services/mobile-gateway/src/

# Install dependencies using standard npm since it's an isolated service
WORKDIR /app/services/mobile-gateway
RUN npm install
RUN npm run build

# Create data directory for SQLite database
RUN mkdir -p /data
ENV DATABASE_PATH=/data/mobile_gateway.db

EXPOSE 5052

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s \
  CMD curl -f http://localhost:5052/health || exit 1

CMD ["npm", "start"]
