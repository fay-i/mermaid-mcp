/**
 * Cache types and interfaces for session-based artifact caching.
 * Per data-model.md entities and TypeScript type definitions.
 */

/**
 * Artifact reference returned by render tools instead of inline content.
 * Lightweight reference for retrieving cached artifacts.
 */
export interface ArtifactRef {
  artifact_id: string;
  uri: string;
  content_type: "image/svg+xml" | "application/pdf";
  size_bytes: number;
}

/**
 * Full artifact metadata stored internally.
 * Represents a rendered diagram output stored on disk.
 */
export interface Artifact {
  id: string;
  sessionId: string;
  contentType: "image/svg+xml" | "application/pdf";
  extension: "svg" | "pdf";
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  path: string;
  uri: string;
}

/**
 * Session metadata for tracking active sessions.
 */
export interface SessionMeta {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  artifactCount: number;
  totalSizeBytes: number;
  directoryPath: string;
}

/**
 * Configuration for the cache system.
 * Loaded from environment variables with sensible defaults.
 */
export interface CacheConfig {
  rootDirectory: string;
  quotaBytes: number;
  enabled: boolean;
  sessionTimeoutMs: number;
  cleanupIntervalMs: number;
}

/**
 * Runtime state of the cache system.
 */
export interface CacheState {
  totalSizeBytes: number;
  sessionCount: number;
  artifactCount: number;
  isHealthy: boolean;
  lastCleanupAt: number | null;
}

/**
 * Error codes for cache operations.
 */
export type CacheErrorCode =
  | "ARTIFACT_NOT_FOUND"
  | "SESSION_MISMATCH"
  | "CACHE_UNAVAILABLE"
  | "CACHE_WRITE_FAILED"
  | "QUOTA_EXCEEDED"
  | "INVALID_ARTIFACT_ID";

/**
 * Cache operation error.
 */
export interface CacheError {
  code: CacheErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result type for cache operations that can fail.
 */
export type CacheResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CacheError };

/**
 * LRU entry for efficient eviction tracking.
 */
export interface LRUEntry {
  artifactId: string;
  sessionId: string;
  lastAccessedAt: number;
  sizeBytes: number;
}

/**
 * Content type to file extension mapping.
 */
export const CONTENT_TYPE_TO_EXTENSION: Record<
  "image/svg+xml" | "application/pdf",
  "svg" | "pdf"
> = {
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/**
 * File extension to content type mapping.
 */
export const EXTENSION_TO_CONTENT_TYPE: Record<
  "svg" | "pdf",
  "image/svg+xml" | "application/pdf"
> = {
  svg: "image/svg+xml",
  pdf: "application/pdf",
};
