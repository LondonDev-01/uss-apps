# -- build stage -----------------------------------------------------------
FROM node:20-slim AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files needed for install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy only the api package (no other apps/services needed)
COPY services/api/package.json services/api/

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile --filter api...

# Copy Prisma schema and generate client
COPY services/api/prisma services/api/prisma
RUN pnpm --filter api run generate

# Copy api source
COPY services/api/src services/api/src
COPY services/api/tsconfig.json services/api/tsconfig.build.json services/api/nest-cli.json services/api/

# Build NestJS
RUN pnpm --filter api run build

# -- runtime stage ----------------------------------------------------------
FROM node:20-slim AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files needed for prisma
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json services/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter api... --prod

# Copy prisma schema and migrations (needed for migrate deploy + generate at runtime)
COPY services/api/prisma services/api/prisma

# Generate Prisma client for production (fast, just generates the query engine)
RUN pnpm --filter api run generate

# Copy built output from build stage
COPY --from=build /app/services/api/dist services/api/dist

# Copy entrypoint script
COPY services/api/docker-entrypoint.sh services/api/
RUN chmod +x services/api/docker-entrypoint.sh

WORKDIR /app/services/api

EXPOSE 3001

ENTRYPOINT ["sh", "docker-entrypoint.sh"]
