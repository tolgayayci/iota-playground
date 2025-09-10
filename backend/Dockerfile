# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies for building
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    ca-certificates \
    libpq5 \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Install IOTA CLI
RUN ARCH=$(uname -m) && \
    echo "Architecture: $ARCH" && \
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then \
        echo "Installing ARM64 version..." && \
        curl -L https://github.com/iotaledger/iota/releases/download/v1.4.1/iota-v1.4.1-linux-arm64.tgz -o iota.tgz; \
    else \
        echo "Installing x86_64 version..." && \
        curl -L https://github.com/iotaledger/iota/releases/download/v1.4.1/iota-v1.4.1-linux.tgz -o iota.tgz; \
    fi && \
    tar -xzf iota.tgz && \
    # Check what files were extracted
    ls -la && \
    # ARM64 tar has iota-node, x86 has target/release/iota
    if [ -f "iota-node" ]; then \
        mv iota-node /usr/local/bin/iota; \
    elif [ -f "target/release/iota" ]; then \
        mv target/release/iota /usr/local/bin/iota; \
    elif [ -f "iota" ]; then \
        mv iota /usr/local/bin/iota; \
    else \
        echo "ERROR: Could not find iota binary" && exit 1; \
    fi && \
    rm -rf iota.tgz target iota-faucet && \
    chmod +x /usr/local/bin/iota && \
    /usr/local/bin/iota --version

# Create non-root user
RUN groupadd -r iota && useradd -r -g iota iota

WORKDIR /app

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy base_project template
COPY base_project /app/base_project

# Create projects directory with proper permissions
RUN mkdir -p /app/projects && \
    chown -R iota:iota /app && \
    chmod -R 755 /app/projects

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV MOVE_COMPILER_PATH=/usr/local/bin/iota

# Expose API port
EXPOSE 3001

# Switch to non-root user
USER iota

# Run the application
CMD ["node", "dist/index.js"]