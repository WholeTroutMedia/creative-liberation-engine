FROM node:22-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src/ ./src/
COPY tsconfig.json ./
RUN npx tsc || true
RUN mkdir -p /tmp/voice-fabric
EXPOSE 5090
CMD ["npx", "tsx", "src/index.ts"]
