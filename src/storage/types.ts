/**
 * Storage Backend Types
 * Feature: 010-local-disk-storage
 */

/**
 * Storage backend type identifier
 */
export type StorageType = "local" | "s3";

/**
 * Storage error codes for standardized error handling
 */
export type StorageErrorCode =
  | "STORAGE_FULL" // Disk full (local)
  | "PERMISSION_DENIED" // Write access denied
  | "ARTIFACT_NOT_FOUND" // Artifact doesn't exist
  | "INVALID_SESSION_ID" // Invalid UUID format
  | "INVALID_ARTIFACT_ID" // Invalid UUID format
  | "S3_ERROR" // S3 operation failed
  | "STORAGE_UNAVAILABLE" // Backend not reachable
  | "CONFIGURATION_ERROR"; // Invalid configuration

/**
 * Result of a storage operation
 */
export interface StorageResult {
  /** UUID of stored artifact */
  artifact_id: string;

  /** Download URL (file:// for local, https:// for S3) */
  download_url: string;

  /** MIME type */
  content_type: "image/svg+xml" | "application/pdf";

  /** Content size in bytes */
  size_bytes: number;

  /** Storage backend type */
  storage_type: StorageType;

  /** S3 presigned URL expiry (S3 only) */
  expires_in_seconds?: number;

  /** S3 location info (S3 only) */
  s3?: {
    bucket: string;
    key: string;
    region: string;
  };
}

/**
 * Abstract interface for artifact storage backends.
 * Implementations: LocalStorageBackend, S3StorageBackend
 */
export interface StorageBackend {
  /**
   * Initialize the storage backend.
   * - For local storage: validates write access and cleans up orphaned files
   * - For S3 storage: no-op
   */
  initialize(): Promise<void>;

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
    contentType: "image/svg+xml" | "application/pdf",
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
  getType(): StorageType;
}

/**
 * Configuration for local storage backend
 */
export interface LocalStorageConfig {
  /** Container path for artifact storage */
  basePath: string;

  /** Host path for file:// URL construction */
  hostPath: string;

  /** URL scheme: 'file' (default) or 'http' */
  urlScheme: "file" | "http";

  /** CDN host for http:// URLs (default: 'localhost') */
  cdnHost?: string;

  /** CDN port for http:// URLs (default: 3001) */
  cdnPort?: number;
}

/**
 * Configuration for S3 storage backend
 */
export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  presignedUrlExpiry: number;
  /** Artifact retention in days (default: 7) */
  retentionDays?: number;
}

/**
 * Combined storage configuration
 */
export interface StorageConfig {
  type: "local" | "s3" | "auto";
  local?: LocalStorageConfig;
  s3?: S3StorageConfig;
}
