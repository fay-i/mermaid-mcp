/**
 * CDN Proxy configuration loader.
 * Reads settings from environment variables.
 * Gracefully handles missing S3 credentials by setting s3.configured=false.
 */

import type { CdnProxyConfig, S3ConfigResult } from "./types.js";

const DEFAULT_PORT = 8101;
const DEFAULT_CACHE_ENABLED = true;
const DEFAULT_CACHE_MAX_SIZE_MB = 256;
const DEFAULT_CACHE_TTL_HOURS = 24;
const DEFAULT_CACHE_THRESHOLD_MB = 1;
const MB_TO_BYTES = 1024 * 1024;
const HOURS_TO_MS = 60 * 60 * 1000;

/**
 * Load S3 configuration from environment variables.
 * Returns configured: false if required credentials are missing.
 */
function loadS3Config(): S3ConfigResult {
  const endpoint = process.env.MERMAID_S3_ENDPOINT;
  const bucket = process.env.MERMAID_S3_BUCKET;
  const accessKeyId = process.env.MERMAID_S3_ACCESS_KEY;
  const secretAccessKey = process.env.MERMAID_S3_SECRET_KEY;
  const region = process.env.MERMAID_S3_REGION ?? "us-east-1";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return { configured: false };
  }

  return {
    configured: true,
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
  };
}

/**
 * Parse an integer environment variable with a default value.
 */
function parseIntEnv(
  envVar: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (!envVar) {
    return defaultValue;
  }
  const parsed = Number.parseInt(envVar, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

/**
 * Parse a boolean environment variable with a default value.
 */
function parseBoolEnv(
  envVar: string | undefined,
  defaultValue: boolean,
): boolean {
  if (!envVar) {
    return defaultValue;
  }
  return envVar.toLowerCase() === "true";
}

/**
 * Detect storage backend type from environment variables.
 * Uses the same logic as storage factory for consistency.
 * Checks MERMAID_S3_* prefix (used by CDN) and S3_* or AWS_* prefix (used by storage factory).
 */
function detectStorageType(): "local" | "s3" | "unknown" {
  const storageType = process.env.STORAGE_TYPE || "auto";

  // Check for explicit type
  if (storageType === "local") {
    return "local";
  }
  if (storageType === "s3") {
    return "s3";
  }

  // Auto-detect: check for S3 credentials (either MERMAID_S3_* or S3_*/AWS_*)
  const hasS3 =
    !!(process.env.MERMAID_S3_ENDPOINT || process.env.S3_ENDPOINT) &&
    !!(process.env.MERMAID_S3_BUCKET || process.env.S3_BUCKET) &&
    !!(process.env.MERMAID_S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID) &&
    !!(process.env.MERMAID_S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY);

  // Check for local storage path
  const hasLocal = !!process.env.CONTAINER_STORAGE_PATH;

  if (hasS3 && !hasLocal) {
    return "s3";
  }
  if (hasLocal && !hasS3) {
    return "local";
  }
  if (hasS3 && hasLocal) {
    // Ambiguous - return unknown, will be handled by storage factory
    return "unknown";
  }

  // Neither configured
  return "unknown";
}

/**
 * Load CDN Proxy configuration from environment variables.
 */
export function loadCdnProxyConfig(): CdnProxyConfig {
  const port = parseIntEnv(
    process.env.MERMAID_CDN_PORT,
    DEFAULT_PORT,
    "MERMAID_CDN_PORT",
  );

  const cacheEnabled = parseBoolEnv(
    process.env.MERMAID_CDN_CACHE_ENABLED,
    DEFAULT_CACHE_ENABLED,
  );

  const cacheMaxSizeMb = parseIntEnv(
    process.env.MERMAID_CDN_CACHE_MAX_SIZE_MB,
    DEFAULT_CACHE_MAX_SIZE_MB,
    "MERMAID_CDN_CACHE_MAX_SIZE_MB",
  );

  const cacheTtlHours = parseIntEnv(
    process.env.MERMAID_CDN_CACHE_TTL_HOURS,
    DEFAULT_CACHE_TTL_HOURS,
    "MERMAID_CDN_CACHE_TTL_HOURS",
  );

  const cacheThresholdMb = parseIntEnv(
    process.env.MERMAID_CDN_CACHE_THRESHOLD_MB,
    DEFAULT_CACHE_THRESHOLD_MB,
    "MERMAID_CDN_CACHE_THRESHOLD_MB",
  );

  const s3Config = loadS3Config();
  const storageType = detectStorageType();
  const localStoragePath =
    storageType === "local" ? process.env.CONTAINER_STORAGE_PATH : undefined;

  return {
    port,
    cacheEnabled,
    cacheMaxSizeBytes: cacheMaxSizeMb * MB_TO_BYTES,
    cacheTtlMs: cacheTtlHours * HOURS_TO_MS,
    cacheThresholdBytes: cacheThresholdMb * MB_TO_BYTES,
    s3: s3Config,
    storageType,
    localStoragePath,
  };
}
