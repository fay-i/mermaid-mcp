# Local Disk Storage — Plan Prompt

Create an implementation plan for enabling local disk storage as the default storage option with S3 as an optional alternative.

## Key Architectural Decisions

1. **Storage Abstraction**: How to abstract storage backends?
   - Interface vs class hierarchy
   - Singleton vs factory pattern
   - Configuration management

2. **Auto-Detection**: How to determine which backend to use?
   - Environment variable priority
   - Graceful fallback behavior
   - Validation at startup

3. **File URL Generation**: How to construct file:// URLs?
   - Inside container: `/app/data/artifacts/<session>/<artifact>`
   - Host path resolution: `/mnt/mermaid/artifacts/<session>/<artifact>`
   - CDN_BASE_URL configuration vs auto-detection

4. **Atomic Writes**: How to ensure data consistency?
   - Write to temp file + atomic rename
   - Error handling for partial writes
   - Cleanup of orphaned temp files

5. **Directory Management**: How to organize files?
   - Session-based subdirectories
   - Lazy directory creation
   - Permissions management

6. **CDN Integration**: How to update CDN proxy?
   - Detect storage backend at startup
   - Local file serving vs S3 proxying
   - Unified HTTP interface

## Context

- Existing S3 storage implementation in `src/storage/s3-client.ts`
- Existing CDN proxy in `src/cdn-proxy/` serves S3 artifacts
- Docker deployment uses environment variables for configuration
- Kubernetes deployment has optional MinIO integration
- Current tools return presigned S3 URLs

## Research Needed

- Node.js `fs/promises` best practices for atomic writes
- Volume mount configuration in Docker Compose
- File URL standards and cross-platform compatibility
- Disk space monitoring strategies
- Permission handling for Docker volumes

## Design Questions

1. **Storage Interface Design**: What methods should the interface expose?
   - `store()`: Write artifact and return URL
   - `retrieve()`: Read artifact content
   - `delete()`: Remove artifact
   - `exists()`: Check artifact presence
   - `getType()`: Return backend type
   - Additional methods needed?

2. **Configuration Priority**: What's the precedence for storage selection?
   - Option A: Explicit `STORAGE_TYPE` overrides everything
   - Option B: Presence of credentials determines backend
   - Option C: Startup validation fails if misconfigured
   - Recommended: `STORAGE_TYPE=auto` → check credentials → default to local

3. **URL Format**: How to construct file:// URLs correctly?
   - Use `CDN_BASE_URL` environment variable (explicit)
   - Auto-construct from `LOCAL_STORAGE_PATH` (implicit)
   - Validate URL format at startup

4. **Error Handling**: How to handle storage failures gracefully?
   - Disk full → Return specific error code
   - Permission denied → Log and fail fast at startup
   - File not found → 404 with clear message
   - Corrupted files → Validate on read, return error

5. **Migration Path**: How to migrate existing S3 data?
   - Out of scope for this feature
   - Document manual migration if needed
   - Support both backends simultaneously (yes)

6. **Cleanup Strategy**: Should old artifacts be deleted?
   - Option A: Manual cleanup only (simple, recommended)
   - Option B: TTL-based automatic cleanup (configurable)
   - Option C: LRU eviction based on disk space (complex)
   - Recommendation: TTL-based, disabled by default

## Implementation Order

### Phase 1: Storage Abstraction Layer

1. Define `StorageBackend` interface
2. Create `LocalStorageBackend` implementation
3. Refactor existing S3 code into `S3StorageBackend` class
4. Create factory function for backend selection
5. Add configuration module for storage settings
6. Unit tests for each backend implementation

### Phase 2: Local Storage Implementation

1. Implement file write with atomic rename
2. Implement file read with error handling
3. Implement session directory management
4. Implement file:// URL generation
5. Add startup validation (write permissions)
6. Add health check for disk space
7. Unit tests for file operations
8. Integration tests for end-to-end flow

### Phase 3: Auto-Detection & Configuration

1. Add environment variable parsing
2. Implement auto-detection logic
3. Add startup logging for selected backend
4. Validate configuration at startup
5. Add configuration documentation
6. Unit tests for backend selection

### Phase 4: Tool Updates

1. Update `mermaid_to_svg` to use storage abstraction
2. Update `mermaid_to_pdf` to use storage abstraction
3. Update `mermaid_to_deck` to use storage abstraction
4. Add `storage_type` field to tool responses
5. Update tool schemas if needed
6. Integration tests for each tool

### Phase 5: CDN Proxy Updates

1. Add storage backend detection to CDN proxy
2. Implement local file serving endpoint
3. Add file read streaming for local files
4. Update health check to show storage type
5. Add Content-Type detection for local files
6. Unit tests for local file serving
7. Integration tests for CDN proxy modes

### Phase 6: Docker & Deployment

1. Update Dockerfile with volume definition
2. Create docker-compose.yml example with volume mount
3. Update Kubernetes deployment (optional local storage)
4. Add deployment documentation
5. Add environment variable reference
6. Test Docker deployment with volume mount

### Phase 7: Documentation & Cleanup

1. Update README with local storage instructions
2. Update architecture documentation
3. Add migration guide (S3 → local if needed)
4. Add troubleshooting section
5. Add examples for common configurations
6. Review and update all related docs

## Implementation Details

### Storage Backend Interface

```typescript
// src/storage/types.ts
export interface StorageBackend {
  store(
    sessionId: string, 
    artifactId: string, 
    content: Buffer, 
    contentType: string
  ): Promise<StorageResult>;
  
  retrieve(sessionId: string, artifactId: string): Promise<Buffer>;
  delete(sessionId: string, artifactId: string): Promise<void>;
  exists(sessionId: string, artifactId: string): Promise<boolean>;
  getType(): 'local' | 's3';
}

export interface StorageResult {
  url: string;           // Download URL (file:// or https://)
  cdnUrl?: string;       // CDN URL if available
  storageType: 'local' | 's3';
  sizeBytes: number;
}
```

### Local Storage Backend Pseudo-code

```typescript
// src/storage/local-backend.ts
export class LocalStorageBackend implements StorageBackend {
  private basePath: string;
  private cdnBaseUrl: string;

  async store(sessionId, artifactId, content, contentType): Promise<StorageResult> {
    // 1. Create session directory if not exists
    const sessionDir = path.join(this.basePath, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    
    // 2. Generate file path
    const ext = getExtensionFromContentType(contentType);
    const fileName = `${artifactId}.${ext}`;
    const filePath = path.join(sessionDir, fileName);
    
    // 3. Atomic write (temp + rename)
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, filePath);
    
    // 4. Generate URL
    const relativePath = `${sessionId}/${fileName}`;
    const url = `${this.cdnBaseUrl}/${relativePath}`;
    
    return {
      url,
      cdnUrl: url,
      storageType: 'local',
      sizeBytes: content.length
    };
  }
  
  async retrieve(sessionId, artifactId): Promise<Buffer> {
    // Find file by scanning for artifact ID
    const sessionDir = path.join(this.basePath, sessionId);
    const files = await fs.readdir(sessionDir);
    const file = files.find(f => f.startsWith(artifactId));
    
    if (!file) throw new NotFoundError();
    
    return fs.readFile(path.join(sessionDir, file));
  }
  
  getType(): 'local' { return 'local'; }
}
```

### Backend Factory

```typescript
// src/storage/factory.ts
export function createStorageBackend(): StorageBackend {
  const storageType = process.env.STORAGE_TYPE || 'auto';
  
  if (storageType === 'local') {
    return new LocalStorageBackend({
      basePath: process.env.LOCAL_STORAGE_PATH || '/app/data/artifacts',
      cdnBaseUrl: process.env.CDN_BASE_URL || 'file:///app/data/artifacts'
    });
  }
  
  if (storageType === 's3') {
    return new S3StorageBackend({
      bucket: requireEnv('AWS_S3_BUCKET'),
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
      endpoint: process.env.AWS_S3_ENDPOINT,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
  
  if (storageType === 'auto') {
    return selectStorageBackendAuto();
  }
  
  throw new Error(`Invalid STORAGE_TYPE: ${storageType}`);
}

function selectStorageBackendAuto(): StorageBackend {
  const hasS3 = process.env.AWS_ACCESS_KEY_ID &&
                process.env.AWS_SECRET_ACCESS_KEY &&
                process.env.AWS_S3_BUCKET;
  
  if (hasS3) {
    console.log('[Storage] Auto-detected S3 configuration, using S3 backend');
    return new S3StorageBackend({...});
  }
  
  console.log('[Storage] No S3 configuration found, using local filesystem backend');
  return new LocalStorageBackend({...});
}
```

## Dependencies

- **Existing**: Node.js `fs/promises` (built-in)
- **Existing**: Node.js `path` (built-in)
- **Existing**: AWS SDK v3 for S3 backend
- **Existing**: CDN proxy infrastructure

## Security Considerations

- **File Permissions**: Ensure container user has write access to volume mount
- **Path Traversal**: Validate session IDs and artifact IDs to prevent directory traversal
- **Disk Space**: Monitor and alert on low disk space (optional)
- **File Access**: Local files are not secured by authentication (same as S3 presigned URLs)
- **Volume Mounts**: Document security implications of host filesystem access

## Testing Strategy

### Unit Tests

- Storage backend interface compliance
- File operations (write, read, delete, exists)
- Atomic write behavior
- Error handling (permissions, not found, disk full)
- URL generation
- Backend selection logic

### Integration Tests

- End-to-end with local storage
- End-to-end with S3 storage
- Auto-detection with various configurations
- CDN proxy with local files
- CDN proxy with S3 files

### Docker Tests

- Volume mount persistence
- Container restart preservation
- Permission handling
- Configuration variations

## Rollout Strategy

1. **Development**: Test locally with volume mount
2. **Staging**: Deploy with local storage, verify behavior
3. **Production**: 
   - Option A: Keep using S3 (no changes)
   - Option B: Switch to local storage with volume mount
   - Option C: Support both based on deployment environment

## Success Metrics

- Local storage works without S3 credentials
- Artifacts persist across container restarts
- S3 storage continues to work when configured
- Zero breaking changes to existing deployments
- Clear documentation for both storage modes
- Performance: Local storage faster than S3 for read/write
