FROM node:20-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY services/sandbox-manager/package.json ./
RUN npm install
COPY services/sandbox-manager/ ./
RUN npx tsc
EXPOSE 5058
ENV SANDBOX_MANAGER_PORT=5058
CMD ["node", "dist/index.js"]

