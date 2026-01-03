/**
 * Structured JSON logger for CDN Proxy.
 * Outputs logs in JSON format for structured logging.
 */

import type { RequestLogEntry, CdnErrorCode } from "./types.js";

/**
 * Log a request completion with structured JSON.
 */
export function logRequest(entry: RequestLogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

/**
 * Create a request log entry.
 */
export function createLogEntry(params: {
  request_id: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  cache: "hit" | "miss" | "bypass" | "disabled";
  artifact_id?: string;
  size_bytes?: number;
  error?: CdnErrorCode;
}): RequestLogEntry {
  return {
    level:
      params.status >= 500 ? "error" : params.status >= 400 ? "warn" : "info",
    request_id: params.request_id,
    method: params.method,
    path: params.path,
    status: params.status,
    duration_ms: params.duration_ms,
    cache: params.cache,
    artifact_id: params.artifact_id,
    size_bytes: params.size_bytes,
    error: params.error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log server startup information.
 */
export function logStartup(config: {
  port: number;
  s3Configured: boolean;
  cacheEnabled: boolean;
  cacheMaxSizeBytes: number;
  cacheTtlMs: number;
}): void {
  const cacheSizeMb = Math.round(config.cacheMaxSizeBytes / (1024 * 1024));
  const cacheTtlHours = Math.round(config.cacheTtlMs / (1000 * 60 * 60));

  console.log(
    JSON.stringify({
      level: "info",
      message: "CDN Proxy starting",
      port: config.port,
      s3_configured: config.s3Configured,
      cache_enabled: config.cacheEnabled,
      cache_max_size_mb: cacheSizeMb,
      cache_ttl_hours: cacheTtlHours,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Log server ready status.
 */
export function logReady(port: number, s3Connected: boolean): void {
  console.log(
    JSON.stringify({
      level: "info",
      message: "CDN Proxy listening",
      port,
      s3_connected: s3Connected,
      timestamp: new Date().toISOString(),
    }),
  );
}
