# Build stage
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:24-slim

# Install chromium dependencies for puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mcp && useradd -r -g mcp -G audio,video mcp \
    && mkdir -p /home/mcp/Downloads \
    && chown -R mcp:mcp /home/mcp

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Install supergateway for stdio-to-SSE proxy
RUN npm install -g supergateway

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Set puppeteer to use system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create volume mount point for local artifact storage
RUN mkdir -p /app/data/artifacts && chown -R mcp:mcp /app/data

# Declare volume for persistent artifact storage
VOLUME ["/app/data/artifacts"]

# Switch to non-root user
USER mcp

# Expose SSE port
EXPOSE 8000

# Default: run via supergateway to expose stdio as SSE
# The data directory is the mounted volume path
CMD ["supergateway", "--stdio", "node dist/index.js /app/data/artifacts", "--port", "8000", "--healthEndpoint", "/health"]
