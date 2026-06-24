FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js .
COPY public ./public

# Gallery port
EXPOSE 3000
# ZigSim OSC UDP port
EXPOSE 9000/udp

ENV NODE_ENV=production
ENV HTTP_PORT=3000
ENV OSC_PORT=9000
# Override this to your NAS photo folder path inside the container
ENV PHOTO_DIR=/photos

CMD ["node", "server.js"]
