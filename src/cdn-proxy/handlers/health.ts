/**
 * Health endpoint handler for CDN Proxy.
 */

import type { ServerResponse } from "node:http";
import type { RequestContext } from "../middleware.js";
import type { HealthStatus } from "../types.js";
import type { S3Fetcher } from "../s3-fetcher.js";
import type { ArtifactCache } from "../cache.js";
import { logRequest, createLogEntry } from "../logger.js";
import { getDurationMs } from "../middleware.js";

/**
 * Health handler dependencies.
 */
export interface HealthHandlerDeps {
  s3Fetcher: S3Fetcher | null;
  cache: ArtifactCache | null;
  getUptimeSeconds: () => number;
}

/**
 * Handle GET /health requests.
 */
export async function handleHealth(
  res: ServerResponse,
  ctx: RequestContext,
  deps: HealthHandlerDeps,
): Promise<void> {
  // Check S3 connectivity
  let s3Connected = false;
  if (deps.s3Fetcher) {
    s3Connected = await deps.s3Fetcher.healthCheck();
  }

  const response: HealthStatus = {
    ok: s3Connected,
    service: "cdn-proxy",
    s3_connected: s3Connected,
    uptime_seconds: deps.getUptimeSeconds(),
    timestamp: new Date().toISOString(),
  };

  // Include cache stats if available (convert to snake_case for API response)
  if (deps.cache) {
    const stats = deps.cache.getStats();
    response.cache = {
      hits: stats.hits,
      misses: stats.misses,
      evictions: stats.evictions,
      size_bytes: stats.sizeBytes,
      max_size_bytes: stats.maxSizeBytes,
      entry_count: stats.entryCount,
      hit_rate: stats.hitRate,
    };
  }

  // Respond with 200 if S3 is configured and connected, or not configured
  // Respond with 503 if S3 is configured but not connected
  const status = deps.s3Fetcher && !s3Connected ? 503 : 200;

  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-Request-Id": ctx.requestId,
  });
  res.end(JSON.stringify(response));

  logRequest(
    createLogEntry({
      request_id: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      status,
      duration_ms: getDurationMs(ctx),
      cache: "disabled",
    }),
  );
}
