# Build stage
FROM node:22-alpine AS builder

# Add labels for better maintainability
LABEL org.opencontainers.image.source="https://github.com/uniclub/uniclub"
LABEL org.opencontainers.image.description="UniClub Backend"

# Update system packages to fix vulnerabilities
RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy shared package
COPY shared/package.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src

# Copy backend package
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

# Install all dependencies (ignore postinstall - we build shared explicitly)
RUN npm ci --workspaces --include-workspace-root --ignore-scripts

# Build shared first, then backend
WORKDIR /app/shared
RUN npm run build

WORKDIR /app/backend
RUN npm run build

# Runner stage
FROM node:22-alpine AS runner

# Update system packages to fix vulnerabilities
RUN apk update && apk upgrade --no-cache && \
    rm -rf /var/cache/apk/*

# Security: Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy shared package (built)
COPY shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist

# Copy backend package.json
COPY backend/package.json ./backend/

# Install production dependencies only and clean cache
# Use --ignore-scripts to skip postinstall (shared is already built)
RUN npm ci --workspaces --include-workspace-root --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

WORKDIR /app/backend

# Switch to non-root user
USER nodejs

# Security: Don't expose internal errors
ENV NODE_ENV=production

EXPOSE 3000

# Use node directly instead of npm for better signal handling
CMD ["node", "dist/index.js"]
