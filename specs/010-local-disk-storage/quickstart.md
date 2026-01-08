# Quickstart: Local Disk Storage

**Feature**: 010-local-disk-storage
**Date**: January 6, 2026

## Overview

This feature enables local filesystem storage as the default for Mermaid MCP server artifacts, removing the requirement for S3 infrastructure.

## Development Setup

### Prerequisites

- Node.js 24+
- npm 10+
- (Optional) Docker 24+

### Quick Test Commands

```bash
# Run quality checks (must pass before any commit)
npm run quality

# Run just unit tests
npm run test

# Run integration tests
npm run test:integration

# Build the project
npm run build
```

### Local Development (No Docker)

```bash
# Clone and install
git clone <repo>
cd mermaid-mcp
npm install

# Set storage to local mode
export STORAGE_TYPE=local
export CONTAINER_STORAGE_PATH=/tmp/mermaid-artifacts
export HOST_STORAGE_PATH=/tmp/mermaid-artifacts

# Build and run
npm run build
node dist/index.js
```

### Docker Development

```bash
# Create data directory on host
mkdir -p ./data/artifacts

# Run with local storage (no S3)
docker run -d \
  --name mermaid-mcp \
  -v $(pwd)/data/artifacts:/app/data/artifacts \
  -e STORAGE_TYPE=local \
  -e CONTAINER_STORAGE_PATH=/app/data/artifacts \
  -e HOST_STORAGE_PATH=$(pwd)/data/artifacts \
  mermaid-mcp:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  mermaid-mcp:
    build: .
    volumes:
      - ./data/artifacts:/app/data/artifacts
    environment:
      - STORAGE_TYPE=local
      - CONTAINER_STORAGE_PATH=/app/data/artifacts
      - HOST_STORAGE_PATH=${PWD}/data/artifacts
```

```bash
# Start
docker-compose up -d

# Verify
docker-compose logs mermaid-mcp
# Should see: "[mermaid-mcp] Using local storage backend"
```

## Testing the Feature

### Manual Test: Local Storage

1. Start server with local storage:
   ```bash
   STORAGE_TYPE=local CONTAINER_STORAGE_PATH=/tmp/artifacts HOST_STORAGE_PATH=/tmp/artifacts node dist/index.js
   ```

2. Use MCP Inspector to call `mermaid_to_svg`:
   ```bash
   npx @modelcontextprotocol/inspector --cli node dist/index.js \
     --method tools/call \
     --tool-name mermaid_to_svg \
     --tool-arg code="graph TD; A-->B"
   ```

3. Verify output includes `file://` URL:
   ```json
   {
     "download_url": "file:///tmp/artifacts/...",
     "storage_type": "local"
   }
   ```

4. Verify file exists:
   ```bash
   ls -la /tmp/artifacts/*/
   ```

### Manual Test: S3 Storage

1. Start server with S3 credentials:
   ```bash
   export STORAGE_TYPE=s3
   export MERMAID_S3_ENDPOINT=http://localhost:9000
   export MERMAID_S3_BUCKET=mermaid
   export MERMAID_S3_ACCESS_KEY=minioadmin
   export MERMAID_S3_SECRET_KEY=minioadmin
   node dist/index.js
   ```

2. Call `mermaid_to_svg` and verify `https://` URL returned.

### Manual Test: Auto-Detection

```bash
# No S3 credentials → local storage
unset MERMAID_S3_ENDPOINT MERMAID_S3_BUCKET MERMAID_S3_ACCESS_KEY MERMAID_S3_SECRET_KEY
STORAGE_TYPE=auto node dist/index.js
# Should log: "Using local storage backend"

# With S3 credentials → S3 storage  
export MERMAID_S3_ENDPOINT=http://localhost:9000
export MERMAID_S3_BUCKET=mermaid
export MERMAID_S3_ACCESS_KEY=minioadmin
export MERMAID_S3_SECRET_KEY=minioadmin
STORAGE_TYPE=auto node dist/index.js
# Should log: "Using S3 storage backend"
```

## Architecture Document Test

The MCP server can generate its own architecture diagrams. After implementation:

```bash
# Start server locally
STORAGE_TYPE=local CONTAINER_STORAGE_PATH=/tmp/artifacts HOST_STORAGE_PATH=/tmp/artifacts node dist/index.js &

# Use MCP to generate architecture diagram
echo '{
  "code": "graph TB\n    subgraph Storage Backend\n        SB[StorageBackend Interface]\n        LSB[LocalStorageBackend]\n        S3B[S3StorageBackend]\n    end\n    SB --> LSB\n    SB --> S3B\n    LSB --> FS[Local Filesystem]\n    S3B --> S3[S3/MinIO]",
  "output_format": "inline"
}' | npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name mermaid_to_svg

# Verify SVG file exists
cat /tmp/artifacts/*/*.svg
```

## Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_TYPE` | `auto` | `auto`, `local`, or `s3` |
| `CONTAINER_STORAGE_PATH` | `/app/data/artifacts` | Container storage path |
| `HOST_STORAGE_PATH` | — | Host path for file:// URLs |
| `MERMAID_S3_*` | — | S3 credentials (see spec) |

## Troubleshooting

### "Permission denied" on startup

```bash
# Fix host directory permissions
chmod 755 ./data/artifacts
# Or run with matching UID
docker run --user $(id -u):$(id -g) ...
```

### "file:// URL not accessible"

- Ensure `HOST_STORAGE_PATH` matches the actual host mount point
- File URLs only work when accessing files on the same machine

### "Configuration error: ambiguous storage"

- Set explicit `STORAGE_TYPE=local` or `STORAGE_TYPE=s3`
- Auto-detection fails when both are configured

## Success Criteria Verification

| Criteria | How to Verify |
|----------|---------------|
| SC-001: Works without S3 in <30s | Time from `npm start` to first render |
| SC-002: Persists across restarts | Stop/start container, verify files exist |
| SC-003: S3 auto-activates | Set credentials, check startup log |
| SC-004: Backend logged at startup | grep "[mermaid-mcp] Using" in logs |
| SC-005: CDN <100ms response | curl with timing on localhost:3001 |
| SC-006: Zero S3 breaking changes | Run existing S3 integration tests |
