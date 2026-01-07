/**
 * Storage Backend Factory
 * Feature: 010-local-disk-storage
 *
 * Creates storage backend instances based on configuration.
 */

import { ConfigurationError } from "./errors.js";
import { loadStorageConfig } from "./config.js";
import { LocalStorageBackend } from "./local-backend.js";
import { S3StorageBackend } from "./s3-backend.js";
import type { StorageBackend, StorageConfig } from "./types.js";

/**
 * Create and initialize a storage backend based on environment configuration.
 *
 * Selection logic:
 * - STORAGE_TYPE=local: Use LocalStorageBackend (requires CONTAINER_STORAGE_PATH)
 * - STORAGE_TYPE=s3: Use S3StorageBackend (requires S3 credentials)
 * - STORAGE_TYPE=auto: Auto-detect based on available configuration
 *   - If only local config → LocalStorageBackend
 *   - If only S3 config → S3StorageBackend
 *   - If both configured → Error (FR-011a)
 *   - If neither configured → Error
 *
 * @returns Initialized StorageBackend instance
 * @throws ConfigurationError if configuration is invalid or ambiguous
 */
export async function createStorageBackend(): Promise<StorageBackend> {
  // Load and validate configuration
  const config = loadStorageConfig();

  // Select backend based on type
  const backend = selectBackend(config);

  // Initialize backend (validates write access for local, no-op for S3)
  await backend.initialize();

  return backend;
}

/**
 * Select storage backend based on configuration.
 * Logs the selected backend for observability (FR-009).
 */
function selectBackend(config: StorageConfig): StorageBackend {
  switch (config.type) {
    case "local":
      return createLocalBackend(config);

    case "s3":
      return createS3Backend(config);

    case "auto":
      return autoDetectBackend(config);

    default:
      throw new ConfigurationError(
        `Unknown storage type: ${config.type}. Must be 'local', 's3', or 'auto'`,
      );
  }
}

/**
 * Create LocalStorageBackend instance.
 * Logs selection for observability.
 */
function createLocalBackend(config: StorageConfig): StorageBackend {
  if (!config.local) {
    throw new ConfigurationError(
      "Local storage configuration missing. Required: CONTAINER_STORAGE_PATH",
    );
  }

  console.log(
    `[StorageFactory] Selected backend: Local (path: ${config.local.basePath})`,
  );

  return new LocalStorageBackend(config.local);
}

/**
 * Create S3StorageBackend instance.
 * Logs selection for observability.
 */
function createS3Backend(config: StorageConfig): StorageBackend {
  if (!config.s3) {
    throw new ConfigurationError(
      "S3 storage configuration missing. Required: S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  console.log(
    `[StorageFactory] Selected backend: S3 (bucket: ${config.s3.bucket}, region: ${config.s3.region})`,
  );

  return new S3StorageBackend(config.s3);
}

/**
 * Auto-detect storage backend based on available configuration.
 *
 * Rules:
 * - Only local configured → LocalStorageBackend
 * - Only S3 configured → S3StorageBackend
 * - Both configured → Error (FR-011a: ambiguity must be resolved explicitly)
 * - Neither configured → Error
 *
 * @throws ConfigurationError if auto-detection is ambiguous
 */
function autoDetectBackend(config: StorageConfig): StorageBackend {
  const hasLocal = !!config.local;
  const hasS3 = !!config.s3;

  // FR-011a: Both configured is an error in auto mode
  if (hasLocal && hasS3) {
    throw new ConfigurationError(
      "Auto-detection failed: Both local and S3 storage are configured. " +
        "Set STORAGE_TYPE=local or STORAGE_TYPE=s3 to resolve ambiguity.",
    );
  }

  // Only local configured
  if (hasLocal && !hasS3) {
    const localConfig = config.local;
    if (!localConfig) {
      throw new ConfigurationError("Local config is unexpectedly undefined");
    }
    console.log(
      `[StorageFactory] Auto-detected backend: Local (path: ${localConfig.basePath})`,
    );
    return new LocalStorageBackend(localConfig);
  }

  // Only S3 configured
  if (!hasLocal && hasS3) {
    const s3Config = config.s3;
    if (!s3Config) {
      throw new ConfigurationError("S3 config is unexpectedly undefined");
    }
    console.log(
      `[StorageFactory] Auto-detected backend: S3 (bucket: ${s3Config.bucket}, region: ${s3Config.region})`,
    );
    return new S3StorageBackend(s3Config);
  }

  // Neither configured
  throw new ConfigurationError(
    "Auto-detection failed: No storage backend configured. " +
      "Set either CONTAINER_STORAGE_PATH (local) or S3_ENDPOINT + credentials (S3).",
  );
}
