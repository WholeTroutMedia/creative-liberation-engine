FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

RUN yarn install

# Copy source and build
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN yarn build 2>/dev/null || yarn tsc

# Runtime env defaults (all overrideable)
ENV NODE_ENV=production \
    DISPATCH_URL=http://dispatch:5050 \
    DEBOUNCE_MS=800 \
    VERBOSE=true

CMD ["node", "dist/index.js"]
