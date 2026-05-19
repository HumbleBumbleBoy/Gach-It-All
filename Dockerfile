FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && apt-get clean

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Add Supabase CA certificate
COPY supabase-ca.crt /usr/local/share/ca-certificates/supabase-ca.crt
RUN chmod 644 /usr/local/share/ca-certificates/supabase-ca.crt && update-ca-certificates

# Install ALL dependencies (including dev for build)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Build the app (both client and server)
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Debug: Check what was built
RUN ls -la dist/server/ || echo "Server build failed!"

EXPOSE 3000

CMD ["node", "dist/server/server.js"]