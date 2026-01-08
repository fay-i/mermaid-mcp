/**
 * Storage Configuration Loader
 * Feature: 010-local-disk-storage
 */

import { ConfigurationError } from "./errors.js";
import { StorageConfigSchema } from "./schemas.js";
import type {
  StorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
} from "./types.js";

/**
 * Load storage configuration from environment variables
 * @returns Validated storage configuration
 * @throws ConfigurationError if configuration is invalid
 */
export function loadStorageConfig(): StorageConfig {
  const rawStorageType = process.env.STORAGE_TYPE || "auto";
  const validTypes = ["local", "s3", "auto"] as const;

  // Validate STORAGE_TYPE
  if (!validTypes.includes(rawStorageType as (typeof validTypes)[number])) {
    throw new ConfigurationError(
      `Invalid STORAGE_TYPE: ${rawStorageType}. Must be one of: local, s3, auto`,
    );
  }

  const storageType = rawStorageType as "local" | "s3" | "auto";

  // Load local storage config
  const localConfig: LocalStorageConfig | undefined = process.env
    .CONTAINER_STORAGE_PATH
    ? (() => {
        // Validate and sanitize LOCAL_URL_SCHEME
        const rawScheme = process.env.LOCAL_URL_SCHEME;
        const allowedSchemes: Array<"file" | "http"> = ["file", "http"];
        const urlScheme: "file" | "http" =
          rawScheme && allowedSchemes.includes(rawScheme as "file" | "http")
            ? (rawScheme as "file" | "http")
            : "file";

        // Validate and sanitize CDN_PORT
        const rawPort = process.env.CDN_PORT;
        let cdnPort = 3001; // default
        if (rawPort) {
          const parsed = Number.parseInt(rawPort, 10);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) {
            cdnPort = parsed;
          }
        }

        return {
          basePath: process.env.CONTAINER_STORAGE_PATH,
          hostPath:
            process.env.HOST_STORAGE_PATH || process.env.CONTAINER_STORAGE_PATH,
          urlScheme,
          cdnHost: process.env.CDN_HOST || "localhost",
          cdnPort,
        };
      })()
    : undefined;

  // Load S3 storage config
  const s3Config: S3StorageConfig | undefined =
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
      ? (() => {
          // Validate and sanitize S3_PRESIGNED_URL_EXPIRY
          let presignedUrlExpiry = 3600; // default
          if (process.env.S3_PRESIGNED_URL_EXPIRY) {
            const expiry = Number.parseInt(
              process.env.S3_PRESIGNED_URL_EXPIRY,
              10,
            );
            if (Number.isFinite(expiry) && expiry > 0) {
              presignedUrlExpiry = expiry;
            }
          }

          return {
            endpoint: process.env.S3_ENDPOINT,
            bucket: process.env.S3_BUCKET,
            region: process.env.AWS_REGION || "us-east-1",
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            presignedUrlExpiry,
          };
        })()
      : undefined;

  const config: StorageConfig = {
    type: storageType,
    local: localConfig,
    s3: s3Config,
  };

  // Validate configuration
  const validation = StorageConfigSchema.safeParse(config);
  if (!validation.success) {
    throw new ConfigurationError(
      `Invalid storage configuration: ${validation.error.message}`,
    );
  }

  // Type-specific validation
  if (storageType === "local" && !localConfig) {
    throw new ConfigurationError(
      "STORAGE_TYPE=local requires CONTAINER_STORAGE_PATH",
    );
  }

  if (storageType === "s3" && !s3Config) {
    throw new ConfigurationError(
      "STORAGE_TYPE=s3 requires S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  if (storageType === "auto" && localConfig && s3Config) {
    throw new ConfigurationError(
      "STORAGE_TYPE=auto cannot have both local and S3 configured. Choose one or set STORAGE_TYPE explicitly.",
    );
  }

  if (storageType === "auto" && !localConfig && !s3Config) {
    throw new ConfigurationError(
      "STORAGE_TYPE=auto requires either local (CONTAINER_STORAGE_PATH) or S3 (S3_ENDPOINT, etc.) configuration",
    );
  }

  return validation.data;
}
