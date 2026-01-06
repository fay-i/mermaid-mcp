# Research: Local Disk Storage

**Feature**: 010-local-disk-storage
**Date**: January 6, 2026

## Research Tasks

### 1. Node.js `fs/promises` Best Practices for Atomic Writes

**Decision**: Use temp file + atomic rename pattern with `fs.writeFile()` + `fs.rename()`.

**Rationale**:
- `fs.rename()` is atomic on POSIX systems when source and destination are on the same filesystem
- Writing to a `.tmp` file first ensures no partial files exist on crash
- If write fails, `.tmp` file is orphaned and cleaned up on next startup (per FR-007a)
- Node.js 24+ provides stable `fs/promises` API with excellent performance

**Alternatives Considered**:
- **Direct write**: Rejected—partial files on crash
- **Copy-on-write**: Rejected—unnecessary complexity for single-file artifacts
- **Database blob storage**: Rejected—adds dependency, defeats purpose of "simple local storage"

**Implementation Pattern**:
```typescript
const tempPath = `${finalPath}.tmp`;
await fs.writeFile(tempPath, content);
await fs.rename(tempPath, finalPath);  // Atomic on same filesystem
```

### 2. Volume Mount Configuration in Docker Compose

**Decision**: Use named volume mount with explicit host path via `HOST_STORAGE_PATH` env var.

**Rationale**:
- Docker Compose supports bind mounts: `${HOST_STORAGE_PATH:-./data}:/app/data`
- Container internal path is consistent: `/app/data/artifacts`
- Host path is configurable for different deployment scenarios
- Named volumes provide automatic directory creation with correct permissions

**Alternatives Considered**:
- **Anonymous volumes**: Rejected—artifacts lost on `docker-compose down -v`
- **Hard-coded paths**: Rejected—inflexible for different environments
- **Docker volumes API**: Rejected—bind mounts simpler for local development

**Configuration Example**:
```yaml
services:
  mermaid-mcp:
    volumes:
      - ${HOST_STORAGE_PATH:-./data/artifacts}:/app/data/artifacts
    environment:
      - HOST_STORAGE_PATH=${HOST_STORAGE_PATH:-./data/artifacts}
      - LOCAL_STORAGE_PATH=/app/data/artifacts
```

### 3. File URL Standards and Cross-Platform Compatibility

**Decision**: Use `file://` URLs with absolute host paths from `HOST_STORAGE_PATH`.

**Rationale**:
- RFC 8089 defines file URI scheme: `file://host/path` where host is often empty for localhost
- Format: `file:///absolute/path/to/file` (three slashes = localhost + absolute path)
- Node.js `URL` class properly handles file URLs across platforms
- MCP clients (Claude Desktop, etc.) can open file:// URLs directly

**Alternatives Considered**:
- **HTTP URLs via CDN proxy**: Supported—user can set `CDN_BASE_URL=http://localhost:3001`
- **Relative paths**: Rejected—ambiguous without base path context
- **file:// with container path**: Rejected—path not accessible from host

**URL Construction**:
```typescript
// HOST_STORAGE_PATH=/mnt/mermaid/artifacts
// sessionId=abc, artifactId=123, ext=svg
const url = `file://${hostStoragePath}/${sessionId}/${artifactId}.${ext}`;
// Result: file:///mnt/mermaid/artifacts/abc/123.svg
```

### 4. Disk Space Monitoring Strategies

**Decision**: Startup validation only; no continuous monitoring (per spec—no automatic cleanup).

**Rationale**:
- Per FR-016, artifacts persist indefinitely—user manages cleanup
- Startup check verifies write permissions and catches permission errors early
- `STORAGE_FULL` error returned when writes fail (FR-015)
- Continuous monitoring adds complexity without value for single-server deployments

**Alternatives Considered**:
- **Percentage threshold alerts**: Rejected—out of scope, external monitoring concern
- **LRU eviction**: Rejected—spec explicitly requires no automatic cleanup
- **Pre-flight space check before write**: Rejected—TOCTOU race condition

**Error Handling**:
```typescript
try {
  await fs.writeFile(tempPath, content);
} catch (error) {
  if (error.code === 'ENOSPC') {
    throw new StorageFullError();
  }
  throw error;
}
```

### 5. Permission Handling for Docker Volumes

**Decision**: Use non-root container user with host UID/GID matching via Docker configuration.

**Rationale**:
- Current Dockerfile creates `mcp` user (non-root)
- Volume mount permissions depend on host directory permissions
- Docker creates mount points with root ownership by default
- Solution: Initialize directory on host with correct permissions, or use `user:` directive

**Alternatives Considered**:
- **Run as root**: Rejected—security best practice violation
- **Runtime permission fix**: Rejected—startup delay, requires privileged operations
- **Named volumes only**: Rejected—bind mounts needed for host path access

**Implementation**:
```dockerfile
# In Dockerfile - already implemented
RUN groupadd -r mcp && useradd -r -g mcp mcp

# In docker-compose.yml
services:
  mermaid-mcp:
    user: "${UID:-1000}:${GID:-1000}"
    volumes:
      - ./data/artifacts:/app/data/artifacts
```

### 6. Storage Backend Interface Design

**Decision**: Interface with 5 methods: `store`, `retrieve`, `delete`, `exists`, `getType`.

**Rationale**:
- Matches existing `S3Storage` method signatures for easy refactoring
- `getType()` enables tools and CDN proxy to report storage mode
- No `list` method needed—artifacts accessed by direct ID
- Stateless interface allows dependency injection and testing

**Interface**:
```typescript
export interface StorageBackend {
  store(sessionId: string, artifactId: string, content: Buffer, contentType: string): Promise<StorageResult>;
  retrieve(sessionId: string, artifactId: string): Promise<Buffer>;
  delete(sessionId: string, artifactId: string): Promise<void>;
  exists(sessionId: string, artifactId: string): Promise<boolean>;
  getType(): 'local' | 's3';
}
```

### 7. Configuration Priority and Auto-Detection

**Decision**: `STORAGE_TYPE=auto` (default) → check S3 credentials → fail if both configured → else use local.

**Rationale**:
- Per FR-011a, ambiguous configuration (both S3 and local) fails startup
- Clear precedence: explicit > auto-detect > default
- `auto` mode enables zero-config local development
- S3 credentials presence is unambiguous detection signal

**Priority Order**:
1. `STORAGE_TYPE=local` → Use local, ignore S3 credentials
2. `STORAGE_TYPE=s3` → Use S3, require credentials or fail
3. `STORAGE_TYPE=auto` (default):
   - S3 credentials present → Use S3
   - No S3 credentials → Use local
   - Both configured → ERROR (per FR-011a)

### 8. NPM Package Distribution

**Decision**: Publish as `@fay-i/mermaid-mcp` with bin entry point for npx execution.

**Rationale**:
- Scoped package prevents naming conflicts
- `bin` field enables `npx @fay-i/mermaid-mcp` execution
- Bundle all dependencies for standalone execution
- `engines` field enforces Node.js 24+ requirement

**package.json additions**:
```json
{
  "name": "@fay-i/mermaid-mcp",
  "bin": {
    "mermaid-mcp": "./dist/index.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": {
    "access": "public"
  }
}
```

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Atomic writes | temp file + fs.rename |
| Volume mounts | Bind mount with HOST_STORAGE_PATH env |
| File URLs | file:// with host-resolvable paths |
| Disk monitoring | Startup validation only |
| Permissions | Non-root user, host UID matching |
| Interface | 5-method StorageBackend interface |
| Auto-detection | Fail on ambiguous config |
| NPM package | @fay-i/mermaid-mcp with bin |

## Unknowns Resolved

All NEEDS CLARIFICATION items from Technical Context have been resolved:
- ✅ Atomic write strategy confirmed
- ✅ Volume mount approach confirmed
- ✅ URL format standardized
- ✅ No continuous disk monitoring
- ✅ Permission handling via Docker user directive
- ✅ Interface design finalized
- ✅ Auto-detection behavior defined
- ✅ Package distribution strategy confirmed
