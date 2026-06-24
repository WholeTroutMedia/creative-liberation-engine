FROM node:20-alpine
RUN apk add --no-cache exiftool python3 py3-pip py3-numpy py3-pillow libraw-tools darktable
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
