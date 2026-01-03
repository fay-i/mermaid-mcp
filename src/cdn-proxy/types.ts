/**
 * CDN Artifact Proxy type definitions.
 * Based on data-model.md specification.
 */

/**
 * Artifact identifier parsed from URL path.
 * Format: /artifacts/{artifactId}.{extension}
 */
export interface ArtifactRef {
  /** UUID of the artifact (e.g., "abc123-def456-...") */
  artifactId: string;

  /** File extension determining content type */
  extension: "svg" | "pdf";
}

/**
 * S3 key derived from artifact reference.
 * Format: {artifactId}.{extension}
 */
export type S3Key = `${string}.svg` | `${string}.pdf`;

/**
 * Cached artifact content and metadata.
 */
export interface CacheEntry {
  /** Raw artifact content as Buffer */
  content: Buffer;

  /** MIME type for Content-Type header */
  contentType: "image/svg+xml" | "application/pdf";

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

/**
 * Cache performance statistics.
 */
export interface CacheStats {
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

/**
 * Cache statistics for API response (snake_case per OpenAPI contract).
 */
export interface CacheStatsResponse {
  hits: number;
  misses: number;
  evictions: number;
  size_bytes: number;
  max_size_bytes: number;
  entry_count: number;
  hit_rate: number;
}

/**
 * Health check response structure.
 */
export interface HealthStatus {
  /** Overall health status */
  ok: boolean;

  /** Service identifier */
  service: "cdn-proxy";

  /** S3/MinIO connectivity status */
  s3_connected: boolean;

  /** Cache statistics (if caching enabled) - snake_case per API contract */
  cache?: CacheStatsResponse;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Service uptime in seconds */
  uptime_seconds: number;
}

/**
 * Error codes for CDN proxy responses.
 */
export type CdnErrorCode =
  | "ARTIFACT_NOT_FOUND" // 404: S3 key does not exist
  | "INVALID_PATH" // 400: URL path malformed
  | "S3_ERROR" // 502: S3 returned an error
  | "NOT_CONFIGURED" // 503: S3 credentials not configured
  | "INTERNAL_ERROR"; // 500: Unexpected server error

/**
 * Error response structure.
 */
export interface ErrorResponse {
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

/**
 * Structured log entry for request logging.
 */
export interface RequestLogEntry {
  /** Log level */
  level: "info" | "warn" | "error";

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
  cache: "hit" | "miss" | "bypass" | "disabled";

  /** Artifact ID (if applicable) */
  artifact_id?: string;

  /** Content size in bytes (if applicable) */
  size_bytes?: number;

  /** Error code (if error) */
  error?: CdnErrorCode;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * CDN Proxy configuration loaded from environment.
 */
export interface CdnProxyConfig {
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

  /** S3 configuration */
  s3: S3ConfigResult;
}

/**
 * S3 configuration result - discriminated union for configured vs unconfigured
 */
export type S3ConfigResult = S3ConfiguredResult | S3UnconfiguredResult;

export interface S3ConfiguredResult {
  configured: true;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface S3UnconfiguredResult {
  configured: false;
}
