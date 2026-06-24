FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY src ./src
RUN npm install -g typescript ts-node
CMD ["ts-node", "src/index.ts"]
