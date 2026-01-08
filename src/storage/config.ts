/**
 * Storage Configuration Loader
 * Feature: 010-local-disk-storage
 */

import { ConfigurationError } from "./errors.js";
import { StorageConfigSchema as BaseStorageConfigSchema } from "./schemas.js";
import type {
  StorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
} from "./types.js";

/**
 * Enhanced storage configuration schema with runtime validation refinements
 */
const StorageConfigSchema = BaseStorageConfigSchema.refine(
  (data) => {
    // storageType==="local" requires localConfig
    if (data.type === "local" && !data.local) {
      return false;
    }
    return true;
  },
  {
    message: "STORAGE_TYPE=local requires CONTAINER_STORAGE_PATH",
  },
)
  .refine(
    (data) => {
      // storageType==="s3" requires s3Config
      if (data.type === "s3" && !data.s3) {
        return false;
      }
      return true;
    },
    {
      message:
        "STORAGE_TYPE=s3 requires S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    },
  )
  .refine(
    (data) => {
      // storageType==="auto" cannot have both
      if (data.type === "auto" && data.local && data.s3) {
        return false;
      }
      return true;
    },
    {
      message:
        "STORAGE_TYPE=auto cannot have both local and S3 configured. Choose one or set STORAGE_TYPE explicitly.",
    },
  )
  .refine(
    (data) => {
      // storageType==="auto" requires at least one
      if (data.type === "auto" && !data.local && !data.s3) {
        return false;
      }
      return true;
    },
    {
      message:
        "STORAGE_TYPE=auto requires either local (CONTAINER_STORAGE_PATH) or S3 (S3_ENDPOINT, etc.) configuration",
    },
  );

/**
 * Validate CDN host to prevent injection attacks.
 * Ensures the host contains only a hostname or IP (optionally with a port),
 * with no URL scheme, path, query, or fragment.
 *
 * @param host - The host string to validate
 * @returns The validated host or "localhost" as a safe default
 */
function validateCdnHost(host: string | undefined): string {
  if (!host) {
    return "localhost";
  }

  // Check for URL scheme (http://, https://, etc.)
  if (host.includes("://")) {
    console.warn(
      `[Config] CDN_HOST contains URL scheme, using default. Got: ${host}`,
    );
    return "localhost";
  }

  // Check for path, query, or fragment
  if (host.includes("/") || host.includes("?") || host.includes("#")) {
    console.warn(
      `[Config] CDN_HOST contains path/query/fragment, using default. Got: ${host}`,
    );
    return "localhost";
  }

  // Validate hostname/IP format (allow alphanumeric, hyphens, dots, colons for IPv6, and optional port)
  // This regex allows:
  // - hostnames: example.com, sub.example.com
  // - IPv4: 192.168.1.1
  // - IPv6: [::1], [2001:db8::1]
  // - with optional port: example.com:8080
  const validHostPattern =
    /^(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*)?(:[0-9]{1,5})?$/;

  if (!validHostPattern.test(host)) {
    console.warn(
      `[Config] CDN_HOST contains invalid characters, using default. Got: ${host}`,
    );
    return "localhost";
  }

  return host;
}

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
          cdnHost: validateCdnHost(process.env.CDN_HOST),
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

  // Validate configuration with Zod refinements
  const validation = StorageConfigSchema.safeParse(config);
  if (!validation.success) {
    throw new ConfigurationError(
      `Invalid storage configuration: ${validation.error.message}`,
    );
  }

  return validation.data;
}
