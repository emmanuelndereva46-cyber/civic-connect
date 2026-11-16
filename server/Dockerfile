FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma Client generation does not connect to the database. Supply a build-only
# placeholder so Prisma 7 config can load without embedding production secrets.
RUN DATABASE_URL="mysql://build:build@127.0.0.1:4000/civicconnect" npm run build

ENV NODE_ENV=production
ENV VERCEL_CONTAINER=1
ENV PORT=80

EXPOSE 80

CMD ["node", "dist/src/server.js"]
