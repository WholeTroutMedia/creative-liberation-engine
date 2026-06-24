FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/sensor-mesh/package.json packages/sensor-mesh/

RUN pnpm install  --shamefully-hoist --filter @cle/sensor-mesh...

COPY packages/sensor-mesh/ packages/sensor-mesh/

WORKDIR /app/packages/sensor-mesh
RUN pnpm run build

EXPOSE 4200

CMD ["node", "dist/index.js"]
