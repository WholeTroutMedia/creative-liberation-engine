FROM node:20-alpine

# Install FFprobe (part of ffmpeg)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npx tsc --project tsconfig.json || true

# Run via tsx for dev simplicity (compiled fallback)
CMD ["npx", "tsx", "src/index.ts"]
