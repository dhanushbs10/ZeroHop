FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server ./server
COPY src/lib/types/protocol.ts ./src/lib/types/protocol.ts

EXPOSE 8080

CMD ["npx", "tsx", "server/index.ts"]
