FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /app
COPY package.json ./
RUN touch pnpm-workspace.yaml pnpm-lock.yaml
COPY pnpm-workspace.yam[l] ./
COPY pnpm-lock.yam[l] ./
COPY . .
RUN if [ -s pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod; else pnpm install --prod; fi
CMD [node, dist/server.js]
