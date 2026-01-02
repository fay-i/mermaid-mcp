/**
 * Cache configuration loader.
 * Reads settings from environment variables with sensible defaults.
 * Per research.md Decision 7.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CacheConfig } from "./types.js";

/** Default cache directory: $TMPDIR/mermaid-mcp-cache */
const DEFAULT_CACHE_DIR = join(tmpdir(), "mermaid-mcp-cache");

/** Default quota: 10GB in bytes */
const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

/** Default session timeout: 1 hour in milliseconds */
const DEFAULT_SESSION_TIMEOUT_MS = 3600000;

/** Default cleanup interval: 5 minutes in milliseconds */
const DEFAULT_CLEANUP_INTERVAL_MS = 300000;

/**
 * Parse a boolean environment variable.
 * Returns true for "true", "1", "yes" (case-insensitive).
 * Returns false for "false", "0", "no" (case-insensitive).
 * Returns undefined if not set or invalid.
 */
function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") {
    return true;
  }
  if (lower === "false" || lower === "0" || lower === "no") {
    return false;
  }
  return undefined;
}

/**
 * Parse a numeric environment variable.
 * Returns the parsed number if valid, undefined otherwise.
 */
function parseNumberEnv(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return undefined;
  }
  return num;
}

/**
 * Load cache configuration from environment variables.
 * All settings have sensible defaults for zero-config startup.
 */
export function loadCacheConfig(): CacheConfig {
  const cacheDir = process.env.MERMAID_CACHE_DIR || DEFAULT_CACHE_DIR;

  // Parse quota in GB and convert to bytes
  const quotaGb = parseNumberEnv(process.env.MERMAID_CACHE_QUOTA_GB);
  const quotaBytes =
    quotaGb !== undefined && quotaGb > 0
      ? quotaGb * 1024 * 1024 * 1024
      : DEFAULT_QUOTA_BYTES;

  // Parse enabled flag (default: true)
  const enabled = parseBooleanEnv(process.env.MERMAID_CACHE_ENABLED) ?? true;

  // Parse session timeout (default: 1 hour)
  const sessionTimeoutMs =
    parseNumberEnv(process.env.MERMAID_SESSION_TIMEOUT_MS) ??
    DEFAULT_SESSION_TIMEOUT_MS;

  // Parse cleanup interval (default: 5 minutes)
  const cleanupIntervalMs =
    parseNumberEnv(process.env.MERMAID_CACHE_CLEANUP_INTERVAL_MS) ??
    DEFAULT_CLEANUP_INTERVAL_MS;

  return {
    rootDirectory: cacheDir,
    quotaBytes,
    enabled,
    sessionTimeoutMs,
    cleanupIntervalMs,
  };
}
