FROM node:22-slim

# Install OpenSSL and dependencies for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && apt-get clean

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the app
COPY . .

# Build the TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

EXPOSE 3000

# Run your Express server
CMD ["node", "dist/server/server.js"]