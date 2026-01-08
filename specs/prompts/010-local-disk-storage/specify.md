# Local Disk Storage — Specify Prompt

Feature: Local Disk Storage with Docker Volume Mount

Enable local filesystem storage as the default storage option via Docker volume mount, with S3 as an optional alternative configured by environment variables. The CDN proxy should serve artifacts via file:// URLs with resolved host paths.

## Problem

Currently, the MCP server stores rendered artifacts exclusively in MinIO S3, which requires:

1. S3 infrastructure (MinIO) running in Kubernetes
2. S3 credentials management via secrets
3. Network latency for artifact retrieval
4. More complex deployment for development/testing environments
5. S3-specific error handling and retry logic

For local development, testing, and simple deployments, S3 adds unnecessary complexity.

## Solution

1. Add local filesystem storage as the default storage backend
2. Use Docker volume mount to persist artifacts on the host filesystem
3. Make S3 storage optional, activated only when environment variables are present
4. CDN proxy serves local files via file:// URLs with resolved absolute host paths
5. Support seamless switching between storage backends via configuration

## Architecture

### Default: Local Disk Storage

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │────▶│   MCP Server    │────▶│  Host Filesystem│
│                 │     │                 │     │  /artifacts     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                        │
        │                       │ Mounts as:             │
        │                       │ /app/data/artifacts    │
        │                       │                        │
        ▼                       ▼                        ▼
   Tool returns           Writes to local        Persisted on host
   file:// URL            volume mount           at /mnt/mermaid
```

### Optional: S3 Storage (when configured)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │────▶│   MCP Server    │────▶│   MinIO S3      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                        │
        │                       │ If AWS_* env vars set  │
        │                       │ Use S3 storage instead │
        │                       │                        │
        ▼                       ▼                        ▼
   Tool returns           Writes to S3           Stored in bucket
   https:// URL           using AWS SDK          with presigned URL
```

## Key Behaviors

- **Default Storage**: Local filesystem at `/app/data/artifacts` (inside container)
- **Docker Volume Mount**: Container path `/app/data/artifacts` → Host path `/mnt/mermaid/artifacts`
- **File Organization**: `<storage-root>/<session_id>/<artifact_id>.<ext>`
- **S3 Fallback**: If `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET` are set, use S3 instead
- **CDN URLs**: For local storage, return `file:///mnt/mermaid/artifacts/<session>/<artifact>.<ext>`
- **Atomic Writes**: Write to temp file, then atomic rename to prevent partial reads
- **Cleanup**: Optional TTL-based cleanup of old artifacts (configurable, default: disabled)
- **Storage Detection**: Automatically detect which backend to use at startup

## Docker Configuration

### docker-compose.yml

```yaml
services:
  mermaid-mcp:
    image: mermaid-mcp:latest
    volumes:
      # Local storage mount (default)
      - /mnt/mermaid/artifacts:/app/data/artifacts
    environment:
      # Optional: S3 configuration (if these are set, S3 is used instead)
      # AWS_ACCESS_KEY_ID: "minioadmin"
      # AWS_SECRET_ACCESS_KEY: "minioadmin"
      # AWS_S3_BUCKET: "mermaid-artifacts"
      # AWS_S3_ENDPOINT: "http://minio:9000"
      
      # Local storage configuration
      STORAGE_TYPE: "auto"  # auto, local, or s3
      LOCAL_STORAGE_PATH: "/app/data/artifacts"
      CDN_BASE_URL: "file:///mnt/mermaid/artifacts"
    ports:
      - "3000:3000"
```

### Dockerfile Updates

```dockerfile
# Create data directory for local storage
RUN mkdir -p /app/data/artifacts && \
    chown -R node:node /app/data

VOLUME ["/app/data/artifacts"]
```

## Storage Abstraction Layer

### Storage Interface

```typescript
interface StorageBackend {
  // Store artifact and return URL
  store(sessionId: string, artifactId: string, content: Buffer, contentType: string): Promise<string>;
  
  // Retrieve artifact content
  retrieve(sessionId: string, artifactId: string): Promise<Buffer>;
  
  // Delete artifact
  delete(sessionId: string, artifactId: string): Promise<void>;
  
  // Check if artifact exists
  exists(sessionId: string, artifactId: string): Promise<boolean>;
  
  // Get backend type
  getType(): 'local' | 's3';
}
```

### Local Filesystem Backend

- Implements `StorageBackend` interface
- Uses Node.js `fs/promises` for async file operations
- Creates session directories automatically
- Atomic writes via temp files + rename
- Returns `file://` URLs with absolute host paths

### S3 Backend (existing)

- Already implemented in `src/storage/s3-client.ts`
- Wraps existing S3 logic to implement `StorageBackend` interface
- Returns presigned HTTPS URLs

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_TYPE` | No | `"auto"` | Storage backend: `auto`, `local`, or `s3` |
| `LOCAL_STORAGE_PATH` | No | `/app/data/artifacts` | Local filesystem path (inside container) |
| `CDN_BASE_URL` | No | (computed) | Base URL for CDN links (file:// or http://) |
| `AWS_ACCESS_KEY_ID` | Conditional | - | S3 access key (required if using S3) |
| `AWS_SECRET_ACCESS_KEY` | Conditional | - | S3 secret key (required if using S3) |
| `AWS_S3_BUCKET` | Conditional | - | S3 bucket name (required if using S3) |
| `AWS_S3_ENDPOINT` | No | - | S3 endpoint URL (for MinIO) |
| `AWS_REGION` | No | `us-east-1` | AWS region |
| `LOCAL_CLEANUP_ENABLED` | No | `false` | Enable TTL-based cleanup |
| `LOCAL_CLEANUP_TTL_HOURS` | No | `24` | Artifact TTL in hours |

### Auto-Detection Logic

```typescript
function selectStorageBackend(): StorageBackend {
  const storageType = process.env.STORAGE_TYPE || 'auto';
  
  if (storageType === 's3') {
    return new S3StorageBackend();
  }
  
  if (storageType === 'local') {
    return new LocalStorageBackend();
  }
  
  // Auto: Use S3 if credentials are configured, otherwise local
  if (storageType === 'auto') {
    const hasS3Creds = process.env.AWS_ACCESS_KEY_ID && 
                       process.env.AWS_SECRET_ACCESS_KEY &&
                       process.env.AWS_S3_BUCKET;
    
    return hasS3Creds ? new S3StorageBackend() : new LocalStorageBackend();
  }
  
  throw new Error(`Invalid STORAGE_TYPE: ${storageType}`);
}
```

## File URL Format

### Inside Container

Artifacts are stored at: `/app/data/artifacts/<session_id>/<artifact_id>.<ext>`

### On Host (via volume mount)

Docker mounts: `/app/data/artifacts` → `/mnt/mermaid/artifacts`

### Returned URLs

```
file:///mnt/mermaid/artifacts/<session_id>/<artifact_id>.svg
file:///mnt/mermaid/artifacts/<session_id>/<artifact_id>.pdf
```

### Example Response

```json
{
  "ok": true,
  "artifact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "download_url": "file:///mnt/mermaid/artifacts/sess_123/a1b2c3d4-e5f6-7890-abcd-ef1234567890.svg",
  "cdn_url": "file:///mnt/mermaid/artifacts/sess_123/a1b2c3d4-e5f6-7890-abcd-ef1234567890.svg",
  "curl_command": "curl -o diagram.svg 'file:///mnt/mermaid/artifacts/sess_123/a1b2c3d4-e5f6-7890-abcd-ef1234567890.svg'",
  "content_type": "image/svg+xml",
  "size_bytes": 2048,
  "storage_type": "local"
}
```

## CDN Proxy Integration

The existing CDN proxy (`008-cdn-artifact-proxy`) should be updated to support local storage:

### Local Storage Mode

- Serve files directly from the local filesystem
- Path mapping: `/artifacts/<session>/<artifact>` → `/app/data/artifacts/<session>/<artifact>`
- No S3 calls, just file reads
- Same HTTP interface, just different backend

### S3 Mode (existing)

- Current behavior: proxy requests to MinIO S3
- No changes needed

## Migration Strategy

### Phase 1: Abstraction Layer (Current Code)

- Introduce `StorageBackend` interface
- Wrap existing S3 code in `S3StorageBackend` class
- No behavior changes yet

### Phase 2: Local Storage Implementation

- Implement `LocalStorageBackend` class
- Add auto-detection logic
- Add configuration environment variables

### Phase 3: Docker & Deployment

- Update Dockerfile with volume mount
- Update docker-compose.yml
- Update Kubernetes deployment (optional volume mount)
- Update documentation

### Phase 4: CDN Proxy Update

- Add local filesystem support to CDN proxy
- Detect storage backend at startup
- Route requests appropriately

## Edge Cases & Error Handling

### Disk Space

- **Problem**: Host disk fills up
- **Solution**: Log error, return `STORAGE_FULL` error code
- **Mitigation**: Monitor disk usage, enable cleanup TTL

### Permissions

- **Problem**: Container lacks write permissions to mounted volume
- **Solution**: Startup health check verifies write access
- **Error**: Fail fast with clear error message

### File Conflicts

- **Problem**: Artifact ID collision (extremely rare with UUID)
- **Solution**: Overwrite (artifact IDs are unique)

### Atomic Writes

- **Problem**: Process crashes during write
- **Solution**: Write to `.tmp` file, atomic rename on success
- **Cleanup**: Orphaned `.tmp` files cleaned up on startup

### Volume Mount Missing

- **Problem**: Container starts without volume mount
- **Solution**: Creates artifacts in ephemeral container storage
- **Warning**: Log warning about missing persistence

## Success Criteria

1. **SC-001**: MCP server starts with local storage by default (no S3 required)
2. **SC-002**: Artifacts persist across container restarts when volume mounted
3. **SC-003**: S3 storage activates automatically when credentials present
4. **SC-004**: File URLs are returned with correct host-resolvable paths
5. **SC-005**: CDN proxy serves local files without S3 dependency
6. **SC-006**: Zero breaking changes to existing S3 deployments
7. **SC-007**: Storage backend selection logs clearly at startup

## Testing Strategy

### Unit Tests

- `LocalStorageBackend` interface implementation
- File write/read operations
- Atomic write behavior
- Error handling (permissions, disk full)

### Integration Tests

- End-to-end with local storage
- End-to-end with S3 storage
- Auto-detection logic
- Volume mount persistence

### Docker Tests

- Build image with volume mount
- Verify artifacts persist across restarts
- Test with and without S3 credentials

## Documentation Updates

- README: Add local storage setup instructions
- ARCHITECTURE: Document storage abstraction layer
- docker-compose.yml: Example with volume mount
- Environment variables reference
