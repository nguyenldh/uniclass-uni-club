# Build stage
FROM node:22-alpine AS builder

LABEL org.opencontainers.image.source="https://github.com/uniclub/uniclub"
LABEL org.opencontainers.image.description="UniClub Frontend"

RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy shared package
COPY shared/package.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src

# Copy frontend package
COPY frontend/package.json ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public

# Install dependencies
RUN npm ci --workspaces --include-workspace-root --ignore-scripts

# Build shared first
WORKDIR /app/shared
RUN npm run build

# Build frontend
WORKDIR /app/frontend

ARG VITE_API_BASE_URL=http://localhost:3000/api
ARG VITE_SOCKET_URL=http://localhost:3000

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# Runner stage - lightweight static server
FROM node:22-alpine AS runner

RUN apk update && apk upgrade --no-cache && \
    rm -rf /var/cache/apk/*

# Install serve globally
RUN npm install -g serve && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy built files
COPY --from=builder /app/frontend/dist ./dist

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5173

# serve -s for SPA routing (fallback to index.html)
CMD ["serve", "-s", "dist", "-l", "5173"]
