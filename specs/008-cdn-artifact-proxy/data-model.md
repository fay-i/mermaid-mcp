# Data Model: CDN Artifact Proxy

**Feature Branch**: `008-cdn-artifact-proxy`
**Date**: 2026-01-02

This document defines the entities, interfaces, and data structures for the CDN Artifact Proxy service.

---

## Entities

### 1. Artifact Reference

An artifact is identified by its UUID and extension. The CDN proxy doesn't store artifacts—it fetches them from S3 and optionally caches them in memory.

```typescript
/**
 * Artifact identifier parsed from URL path.
 * Format: /artifacts/{artifactId}.{extension}
 */
interface ArtifactRef {
  /** UUID of the artifact (e.g., "abc123-def456-...") */
  artifactId: string;

  /** File extension determining content type */
  extension: 'svg' | 'pdf';
}

/**
 * S3 key derived from artifact reference.
 * Format: {artifactId}.{extension}
 */
type S3Key = `${string}.svg` | `${string}.pdf`;
```

**Validation Rules**:
- `artifactId`: Must be valid UUID format (36 characters with hyphens)
- `extension`: Must be exactly "svg" or "pdf"

**Note**: Artifacts are stored with flat UUID keys in S3 (no session prefix). The URL path `/artifacts/{artifactId}.{ext}` directly maps to S3 key `{artifactId}.{ext}`.

---

### 2. Cache Entry

Represents an artifact cached in memory.

```typescript
/**
 * Cached artifact content and metadata.
 */
interface CacheEntry {
  /** Raw artifact content as Buffer */
  content: Buffer;

  /** MIME type for Content-Type header */
  contentType: 'image/svg+xml' | 'application/pdf';

  /** Size in bytes (for LRU size calculation) */
  sizeBytes: number;

  /** When the entry was cached (for TTL calculation) */
  cachedAt: number;

  /** S3 metadata for response headers */
  s3Metadata: {
    etag?: string;
    lastModified?: Date;
  };
}
```

**Eviction Rules**:
- **LRU**: Least recently accessed entries evicted first
- **Size Limit**: Total cache size capped at `maxSizeBytes` (default: 256MB)
- **TTL**: Entries expire after `ttlMs` (default: 24 hours)

---

### 3. Cache Statistics

Metrics for monitoring cache performance.

```typescript
/**
 * Cache performance statistics.
 */
interface CacheStats {
  /** Number of cache hits */
  hits: number;

  /** Number of cache misses (S3 fetches) */
  misses: number;

  /** Number of entries evicted (LRU or TTL) */
  evictions: number;

  /** Current cache size in bytes */
  sizeBytes: number;

  /** Maximum allowed cache size in bytes */
  maxSizeBytes: number;

  /** Number of entries in cache */
  entryCount: number;

  /** Hit rate as decimal (hits / (hits + misses)) */
  hitRate: number;
}
```

---

### 4. Health Status

Service health and connectivity information.

```typescript
/**
 * Health check response structure.
 */
interface HealthStatus {
  /** Overall health status */
  ok: boolean;

  /** Service identifier */
  service: 'cdn-proxy';

  /** S3/MinIO connectivity status */
  s3_connected: boolean;

  /** Cache statistics (if caching enabled) */
  cache?: CacheStats;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Service uptime in seconds */
  uptime_seconds: number;
}
```

---

### 5. Configuration

Environment-based configuration.

```typescript
/**
 * CDN Proxy configuration loaded from environment.
 */
interface CdnProxyConfig {
  /** HTTP server port (default: 8101) */
  port: number;

  /** Enable in-memory caching (default: true) */
  cacheEnabled: boolean;

  /** Maximum cache size in bytes (default: 256MB) */
  cacheMaxSizeBytes: number;

  /** Cache entry TTL in milliseconds (default: 24 hours) */
  cacheTtlMs: number;

  /** Threshold for caching: only cache artifacts smaller than this (default: 1MB) */
  cacheThresholdBytes: number;

  /** S3 configuration (reused from existing s3-config.ts) */
  s3: S3Config;
}

/**
 * Environment variable mapping.
 */
const CONFIG_ENV_VARS = {
  port: 'MERMAID_CDN_PORT',                    // default: 8101
  cacheEnabled: 'MERMAID_CDN_CACHE_ENABLED',   // default: true
  cacheMaxSizeBytes: 'MERMAID_CDN_CACHE_MAX_SIZE_MB', // default: 256 (in MB)
  cacheTtlMs: 'MERMAID_CDN_CACHE_TTL_HOURS',   // default: 24 (in hours)
  cacheThresholdBytes: 'MERMAID_CDN_CACHE_THRESHOLD_MB', // default: 1 (in MB)
};
```

---

### 6. Error Response

Structured error responses for clients.

```typescript
/**
 * Error codes for CDN proxy responses.
 */
type CdnErrorCode =
  | 'ARTIFACT_NOT_FOUND'  // 404: S3 key does not exist
  | 'INVALID_PATH'        // 400: URL path malformed
  | 'S3_ERROR'            // 502: S3 returned an error
  | 'NOT_CONFIGURED'      // 503: S3 credentials not configured
  | 'INTERNAL_ERROR';     // 500: Unexpected server error

/**
 * Error response structure.
 */
interface ErrorResponse {
  /** Stable error code */
  error: CdnErrorCode;

  /** Human-readable message */
  message: string;

  /** Request path for debugging */
  path: string;

  /** Request ID for correlation */
  request_id: string;

  /** ISO 8601 timestamp */
  timestamp: string;
}
```

---

### 7. Request Log Entry

Structured JSON log format for each request.

```typescript
/**
 * Structured log entry for request logging.
 */
interface RequestLogEntry {
  /** Log level */
  level: 'info' | 'warn' | 'error';

  /** Request ID (UUID) */
  request_id: string;

  /** HTTP method */
  method: string;

  /** Request path */
  path: string;

  /** Response status code */
  status: number;

  /** Request duration in milliseconds */
  duration_ms: number;

  /** Cache hit/miss indicator */
  cache: 'hit' | 'miss' | 'bypass' | 'disabled';

  /** Artifact ID (if applicable) */
  artifact_id?: string;

  /** Content size in bytes (if applicable) */
  size_bytes?: number;

  /** Error code (if error) */
  error?: CdnErrorCode;

  /** ISO 8601 timestamp */
  timestamp: string;
}
```

---

## Relationships

```text
┌─────────────────┐     ┌─────────────────┐
│   HTTP Request  │────▶│  ArtifactRef    │
│   GET /artifacts│     │  - artifactId   │
│   /{id}.{ext}   │     │  - extension    │
└─────────────────┘     └────────┬────────┘
                                 │
                      ┌──────────┴──────────┐
                      │                     │
               ┌──────▼──────┐       ┌──────▼──────┐
               │  LRU Cache  │       │   S3/MinIO  │
               │ (in-memory) │◀──────│   Storage   │
               │             │ miss  │             │
               └──────┬──────┘       └─────────────┘
                      │ hit
               ┌──────▼──────┐
               │ HTTP Response│
               │ - Content    │
               │ - Headers    │
               └──────────────┘
```

---

## State Transitions

### Request Flow States

```text
┌─────────┐     ┌─────────────┐     ┌───────────────┐
│ RECEIVED│────▶│ PARSE_PATH  │────▶│ VALIDATE_PATH │
└─────────┘     └─────────────┘     └───────┬───────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
             ┌──────▼──────┐                                 ┌──────▼──────┐
             │ VALID_PATH  │                                 │ INVALID_PATH│
             └──────┬──────┘                                 └──────┬──────┘
                    │                                               │
             ┌──────▼──────┐                                 ┌──────▼──────┐
             │ CHECK_CACHE │                                 │ RETURN_400  │
             └──────┬──────┘                                 └─────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
  ┌──────▼──────┐       ┌──────▼──────┐
  │ CACHE_HIT   │       │ CACHE_MISS  │
  └──────┬──────┘       └──────┬──────┘
         │                     │
         │              ┌──────▼──────┐
         │              │ FETCH_S3    │
         │              └──────┬──────┘
         │                     │
         │           ┌─────────┴─────────┐
         │           │                   │
         │    ┌──────▼──────┐     ┌──────▼──────┐
         │    │ S3_SUCCESS  │     │ S3_NOT_FOUND│
         │    └──────┬──────┘     └──────┬──────┘
         │           │                   │
         │    ┌──────▼──────┐     ┌──────▼──────┐
         │    │ UPDATE_CACHE│     │ RETURN_404  │
         │    └──────┬──────┘     └─────────────┘
         │           │
         └─────┬─────┘
               │
        ┌──────▼──────┐
        │ STREAM_RESP │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ LOG_REQUEST │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ COMPLETE    │
        └─────────────┘
```

---

## Content Type Mapping

| Extension | Content-Type | S3 Key Pattern |
|-----------|--------------|----------------|
| `svg` | `image/svg+xml` | `{uuid}.svg` |
| `pdf` | `application/pdf` | `{uuid}.pdf` |

---

## Response Headers

### Success Response (200)

| Header | Value | Notes |
|--------|-------|-------|
| `Content-Type` | `image/svg+xml` or `application/pdf` | From extension |
| `Content-Length` | Number | Artifact size in bytes |
| `Cache-Control` | `public, max-age=86400` | 24 hours client cache |
| `X-Artifact-Id` | UUID | Artifact identifier |
| `X-Cache` | `HIT` or `MISS` | Cache status |
| `X-Request-Id` | UUID | Request correlation |
| `ETag` | String | From S3 if available |

### Error Response (4xx/5xx)

| Header | Value | Notes |
|--------|-------|-------|
| `Content-Type` | `application/json` | Always JSON |
| `X-Request-Id` | UUID | Request correlation |
