# Multi-stage build for IOTA Playground backend
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) for building
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Install runtime dependencies, nginx, certbot, and PostgreSQL libraries
RUN apt-get update && apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    supervisor \
    curl \
    git \
    bash \
    openssl \
    ca-certificates \
    libpq5 \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Install IOTA CLI for Move compilation
# Using IOTA v1.4.1 release
RUN ARCH=$(uname -m) && \
    echo "Architecture: $ARCH" && \
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then \
        echo "ARM64 detected - installing IOTA CLI v1.4.1 for ARM..." && \
        curl -L https://github.com/iotaledger/iota/releases/download/v1.4.1/iota-v1.4.1-linux-arm64.tgz -o /tmp/iota.tgz; \
    else \
        echo "x86_64 detected - installing IOTA CLI v1.4.1 for x86..." && \
        curl -L https://github.com/iotaledger/iota/releases/download/v1.4.1/iota-v1.4.1-linux-x86_64.tgz -o /tmp/iota.tgz; \
    fi && \
    tar -xzf /tmp/iota.tgz -C /tmp/ && \
    mv /tmp/iota /usr/local/bin/iota && \
    chmod +x /usr/local/bin/iota && \
    /usr/local/bin/iota --version && \
    rm -rf /tmp/iota*

# Create app directory
WORKDIR /app

# Create non-root user for security (handle existing GID gracefully)
RUN groupadd -g 1000 iota 2>/dev/null || groupadd iota && \
    useradd -u 1000 -g iota -m -s /bin/bash iota 2>/dev/null || useradd -g iota -m -s /bin/bash iota && \
    chown -R iota:iota /app

# Copy package files first and install production dependencies
COPY --chown=iota:iota package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=iota:iota /app/dist ./dist
COPY --chown=iota:iota base_project ./base_project

# Create projects directory for persistent storage
RUN mkdir -p /app/projects && \
    chown -R iota:iota /app/projects && \
    chmod -R 755 /app/projects

# Create necessary directories for nginx and certbot
RUN mkdir -p /var/www/certbot && \
    mkdir -p /etc/nginx/ssl && \
    mkdir -p /var/log/supervisor && \
    mkdir -p /run/nginx && \
    rm -f /etc/nginx/sites-enabled/default

# Copy configuration files
COPY nginx.conf /etc/nginx/sites-available/api
RUN ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/api
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV STORAGE_PATH=/app/projects
ENV MOVE_COMPILER_PATH=/usr/local/bin/iota
ENV COMPILER_WORKSPACE=/app/projects

# Expose ports
EXPOSE 3001 8444 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if(r.statusCode !== 200) process.exit(1);})" || exit 1

# Run with entrypoint
ENTRYPOINT ["/entrypoint.sh"]