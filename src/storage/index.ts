/**
 * Storage module exports.
 */

// Legacy S3 exports (backward compatibility)
export { loadS3Config, type S3Config } from "./s3-config.js";
export { S3Storage, type ArtifactResult } from "./s3-client.js";

// New storage abstraction exports (010-local-disk-storage)
export type {
  StorageBackend,
  StorageResult,
  StorageType,
  StorageErrorCode,
  LocalStorageConfig,
  S3StorageConfig,
  StorageConfig,
} from "./types.js";

export {
  StorageError,
  StorageFullError,
  StoragePermissionError,
  ArtifactNotFoundError,
  InvalidSessionIdError,
  InvalidArtifactIdError,
  S3Error,
  StorageUnavailableError,
  ConfigurationError,
} from "./errors.js";

export {
  StorageResultSchema,
  LocalStorageConfigSchema,
  S3StorageConfigSchema,
  StorageConfigSchema,
} from "./schemas.js";

export { loadStorageConfig } from "./config.js";

export { LocalStorageBackend } from "./local-backend.js";
