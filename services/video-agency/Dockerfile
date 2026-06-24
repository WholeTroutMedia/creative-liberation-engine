FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN npm install
COPY src/ ./src/
COPY tsconfig.json ./
RUN npx tsc || true
EXPOSE 5103
CMD ["node", "build/index.js"]
