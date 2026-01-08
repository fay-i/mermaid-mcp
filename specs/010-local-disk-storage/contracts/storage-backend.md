# Storage Backend API Contracts

**Feature**: 010-local-disk-storage
**Date**: January 6, 2026

## StorageBackend Interface

### TypeScript Interface Definition

```typescript
/**
 * Abstract interface for artifact storage backends.
 * Implementations: LocalStorageBackend, S3StorageBackend
 */
export interface StorageBackend {
  /**
   * Store an artifact and return download URL.
   * @param sessionId - UUID for session grouping
   * @param artifactId - UUID for artifact identification
   * @param content - Binary content to store
   * @param contentType - MIME type ('image/svg+xml' | 'application/pdf')
   * @returns Storage result with download URL
   * @throws StorageFullError if disk is full
   * @throws StoragePermissionError if write access denied
   */
  store(
    sessionId: string,
    artifactId: string,
    content: Buffer,
    contentType: 'image/svg+xml' | 'application/pdf'
  ): Promise<StorageResult>;

  /**
   * Retrieve artifact content by ID.
   * @param sessionId - Session UUID
   * @param artifactId - Artifact UUID
   * @returns Binary content
   * @throws ArtifactNotFoundError if artifact doesn't exist
   */
  retrieve(sessionId: string, artifactId: string): Promise<Buffer>;

  /**
   * Delete an artifact.
   * @param sessionId - Session UUID
   * @param artifactId - Artifact UUID
   * @throws ArtifactNotFoundError if artifact doesn't exist
   */
  delete(sessionId: string, artifactId: string): Promise<void>;

  /**
   * Check if artifact exists.
   * @param sessionId - Session UUID
   * @param artifactId - Artifact UUID
   * @returns true if artifact exists
   */
  exists(sessionId: string, artifactId: string): Promise<boolean>;

  /**
   * Get storage backend type.
   * @returns 'local' or 's3'
   */
  getType(): 'local' | 's3';
}
```

### StorageResult Interface

```typescript
export interface StorageResult {
  /** UUID of stored artifact */
  artifact_id: string;
  
  /** Download URL (file:// for local, https:// for S3) */
  download_url: string;
  
  /** MIME type */
  content_type: 'image/svg+xml' | 'application/pdf';
  
  /** Content size in bytes */
  size_bytes: number;
  
  /** Storage backend type */
  storage_type: 'local' | 's3';
  
  /** S3 presigned URL expiry (S3 only) */
  expires_in_seconds?: number;
  
  /** S3 location info (S3 only) */
  s3?: {
    bucket: string;
    key: string;
    region: string;
  };
}
```

### Error Types

```typescript
export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export type StorageErrorCode =
  | 'STORAGE_FULL'        // Disk full (local)
  | 'PERMISSION_DENIED'   // Write access denied
  | 'ARTIFACT_NOT_FOUND'  // Artifact doesn't exist
  | 'INVALID_SESSION_ID'  // Invalid UUID format
  | 'INVALID_ARTIFACT_ID' // Invalid UUID format
  | 'S3_ERROR'            // S3 operation failed
  | 'STORAGE_UNAVAILABLE' // Backend not reachable
```

---

## Factory Function Contract

### createStorageBackend()

```typescript
/**
 * Create storage backend based on configuration.
 * 
 * @returns Configured storage backend
 * @throws ConfigurationError if:
 *   - STORAGE_TYPE=s3 but S3 credentials missing
 *   - STORAGE_TYPE=auto and both local path and S3 credentials configured
 *   - Invalid STORAGE_TYPE value
 */
export async function createStorageBackend(): Promise<StorageBackend>;
```

### Configuration Resolution

| STORAGE_TYPE | S3 Credentials | Result |
|--------------|----------------|--------|
| 'local' | Any | LocalStorageBackend |
| 's3' | Present | S3StorageBackend |
| 's3' | Missing | ConfigurationError |
| 'auto' | Present | S3StorageBackend |
| 'auto' | Missing | **ConfigurationError** (neither configured) |
| 'auto' | Both configured | ConfigurationError |

---

## LocalStorageBackend Contract

### Constructor

```typescript
export interface LocalStorageConfig {
  /** Container path for artifact storage */
  basePath: string;
  
  /** Host path for file:// URL construction */
  hostPath: string;
  
  /** URL scheme: 'file' (default) or 'http' */
  urlScheme: 'file' | 'http';
  
  /** CDN host for http:// URLs (default: 'localhost') */
  cdnHost?: string;
  
  /** CDN port for http:// URLs (default: 3001) */
  cdnPort?: number;
}

export class LocalStorageBackend implements StorageBackend {
  constructor(config: LocalStorageConfig);
}
```

### Behavior Contracts

#### store()

**Preconditions**:
- `sessionId` is valid UUID format
- `artifactId` is valid UUID format
- `content` is non-empty Buffer
- `contentType` is 'image/svg+xml' or 'application/pdf'
- Write permission to `basePath`

**Postconditions**:
- File exists at `{basePath}/{sessionId}/{artifactId}.{ext}`
- No `.tmp` file remains
- Session directory created if not exists

**Error Conditions**:
- Disk full → `STORAGE_FULL`
- Permission denied → `PERMISSION_DENIED`
- Invalid sessionId → `INVALID_SESSION_ID`
- Invalid artifactId → `INVALID_ARTIFACT_ID`

**Atomicity Guarantee**:
- Write to `.tmp` file first
- Atomic rename to final path
- No partial files on crash

#### retrieve()

**Preconditions**:
- Artifact exists at expected path

**Postconditions**:
- Returns exact content that was stored

**Error Conditions**:
- File not found → `ARTIFACT_NOT_FOUND`

#### delete()

**Preconditions**:
- Artifact exists

**Postconditions**:
- File removed from filesystem
- Empty session directories NOT automatically removed

**Error Conditions**:
- File not found → `ARTIFACT_NOT_FOUND`

#### exists()

**Preconditions**:
- `sessionId` must be valid UUID format (throws `InvalidSessionIdError` if invalid)
- `artifactId` must be valid UUID format (throws `InvalidArtifactIdError` if invalid)

**Postconditions**:
- Returns `true` if file exists, `false` otherwise
- **LocalStorageBackend**: Never throws for operational errors (filesystem errors return `false`)
- **S3StorageBackend**: Returns `false` for "NotFound" errors, but may throw for operational errors (network failures, access denied, etc.) via `mapS3Error()`

**Note**: Consider reconciling this behavior to make exists() consistent across backends - either make S3StorageBackend also return `false` for all operational errors, or update callers to handle potential exceptions from S3 operations.

#### getType()

**Returns**: `'local'`

---

## S3StorageBackend Contract

### Constructor

```typescript
export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  presignedUrlExpiresIn: number;
}

export class S3StorageBackend implements StorageBackend {
  constructor(config: S3StorageConfig);
}
```

### Behavior Contracts

#### store()

**Preconditions**:
- S3 bucket exists and is accessible
- Valid credentials

**Postconditions**:
- Object stored at `{bucket}/{artifactId}.{ext}`
- Presigned URL generated

**Error Conditions**:
- S3 error → `S3_ERROR`
- Network failure → `STORAGE_UNAVAILABLE`

#### retrieve()

**Postconditions**:
- Returns object content from S3

**Error Conditions**:
- Object not found → `ARTIFACT_NOT_FOUND`
- S3 error → `S3_ERROR`

#### getType()

**Returns**: `'s3'`

#### exists()

**Postconditions**:
- Returns `true` if object exists in S3, `false` if not found (NotFound/NoSuchKey)
- **May throw** on S3-level failures: access denied, network errors, etc.
- Throws via `mapS3Error()` for operational errors (e.g., `S3_ERROR`, `PERMISSION_DENIED`)

**Contrast with LocalStorageBackend**:
- LocalStorageBackend.exists() never throws for operational errors (returns `false`)
- S3StorageBackend.exists() propagates S3 operational errors to caller
- Both validate UUIDs and throw validation errors (`InvalidSessionIdError`, `InvalidArtifactIdError`)

---

## S3 Backward Compatibility Guarantees

The S3StorageBackend wrapper MUST preserve these existing behaviors:

1. **URL Format**: Presigned URLs returned as-is from AWS/MinIO (scheme determined by provider)

2. **Key Format**: Artifact keys unchanged: `{artifact_id}.{ext}` (flat structure, no session prefix)

3. **Environment Variables**: These existing variables MUST continue working:
   - `S3_ENDPOINT` or `AWS_ENDPOINT_URL`
   - `S3_BUCKET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`

4. **Response Format**: Tool responses MUST include same fields:
   - `artifact_id`, `download_url`, `content_type`, `size_bytes`
   - `expires_in_seconds` for presigned URLs
   - `s3` object with `bucket`, `key`, `region`

5. **Error Codes**: Existing S3 error handling preserved (no new error codes for existing failure modes)

---

## CDN Proxy Contract Extensions

### Health Check Response

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime_seconds: number;
  storage: {
    type: 'local' | 's3';
    connected: boolean;
    path?: string;      // Local only
    bucket?: string;    // S3 only
  };
  cache?: {
    enabled: boolean;
    entries: number;
    size_bytes: number;
  };
}
```

### Artifact Endpoint

```
GET /artifacts/{sessionId}/{artifactId}.{ext}
```

**Local Storage Behavior**:
- Read file directly from `{LOCAL_STORAGE_PATH}/{sessionId}/{artifactId}.{ext}`
- Stream file content in response
- Set `Content-Type` from extension

**S3 Storage Behavior** (existing):
- Fetch from S3 bucket
- Cache if enabled
- Proxy to client

**Response Headers**:
```
Content-Type: image/svg+xml | application/pdf
Content-Length: {size_bytes}
Cache-Control: public, max-age=31536000
```

**Error Responses**:
- 404: Artifact not found
- 500: Storage backend error
