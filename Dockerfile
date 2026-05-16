FROM node:22-slim

# Install OpenSSL and dependencies for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && apt-get clean

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/server/server.js"]
