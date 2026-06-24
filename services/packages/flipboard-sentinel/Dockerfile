FROM node:20-alpine

WORKDIR /app

# Install pnpm and tsx globally using npm
RUN npm install -g pnpm tsx typescript

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy source code and env
COPY src ./src
COPY tsconfig.json ./

CMD ["pnpm", "start"]
