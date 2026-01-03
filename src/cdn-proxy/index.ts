/**
 * CDN Artifact Proxy entry point.
 * HTTP server for serving Mermaid artifacts from S3/MinIO storage.
 */

import http from "node:http";
import { loadCdnProxyConfig } from "./config.js";
import { parseRoute } from "./router.js";
import { sendError } from "./errors.js";
import { createRequestContext, getDurationMs } from "./middleware.js";
import { logRequest, createLogEntry, logStartup, logReady } from "./logger.js";
import { handleHealth } from "./handlers/health.js";
import { handleArtifact } from "./handlers/artifact.js";
import { createS3Fetcher } from "./s3-fetcher.js";
import { createCache } from "./cache.js";

/** Service start time for uptime calculation */
const startTime = Date.now();

/**
 * Get uptime in seconds.
 */
export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Create and start the HTTP server.
 */
async function main(): Promise<void> {
  const config = loadCdnProxyConfig();

  // Log startup configuration
  logStartup({
    port: config.port,
    s3Configured: config.s3.configured,
    cacheEnabled: config.cacheEnabled,
    cacheMaxSizeBytes: config.cacheMaxSizeBytes,
    cacheTtlMs: config.cacheTtlMs,
  });

  // Create S3 fetcher if configured
  const s3Fetcher = config.s3.configured
    ? createS3Fetcher({
        endpoint: config.s3.endpoint,
        bucket: config.s3.bucket,
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
        region: config.s3.region,
      })
    : null;

  // Create cache if enabled
  const cache = config.cacheEnabled
    ? createCache({
        maxSizeBytes: config.cacheMaxSizeBytes,
        ttlMs: config.cacheTtlMs,
        thresholdBytes: config.cacheThresholdBytes,
      })
    : null;

  // Verify S3 connectivity at startup
  let s3Connected = false;
  if (s3Fetcher) {
    s3Connected = await s3Fetcher.healthCheck();
  }

  const server = http.createServer(async (req, res) => {
    const ctx = createRequestContext(req);

    try {
      const route = parseRoute(ctx.path);

      switch (route.type) {
        case "health":
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache,
            getUptimeSeconds,
          });
          break;

        case "artifact":
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache,
          });
          break;

        case "invalid_path":
          sendError(res, "INVALID_PATH", ctx.path, ctx.requestId);
          logRequest(
            createLogEntry({
              request_id: ctx.requestId,
              method: ctx.method,
              path: ctx.path,
              status: 400,
              duration_ms: getDurationMs(ctx),
              cache: "disabled",
              error: "INVALID_PATH",
            }),
          );
          break;

        case "not_found":
          res.writeHead(404, {
            "Content-Type": "application/json",
            "X-Request-Id": ctx.requestId,
          });
          res.end(
            JSON.stringify({
              error: "NOT_FOUND",
              message: "Endpoint not found",
              path: ctx.path,
              request_id: ctx.requestId,
              timestamp: new Date().toISOString(),
            }),
          );
          logRequest(
            createLogEntry({
              request_id: ctx.requestId,
              method: ctx.method,
              path: ctx.path,
              status: 404,
              duration_ms: getDurationMs(ctx),
              cache: "disabled",
            }),
          );
          break;
      }
    } catch (error) {
      console.error("Unhandled error:", error);
      sendError(res, "INTERNAL_ERROR", ctx.path, ctx.requestId);
      logRequest(
        createLogEntry({
          request_id: ctx.requestId,
          method: ctx.method,
          path: ctx.path,
          status: 500,
          duration_ms: getDurationMs(ctx),
          cache: "disabled",
          error: "INTERNAL_ERROR",
        }),
      );
    }
  });

  server.listen(config.port, () => {
    logReady(config.port, s3Connected);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "Shutting down",
        timestamp: new Date().toISOString(),
      }),
    );
    server.close();
  });
}

main().catch((error) => {
  console.error("Failed to start CDN proxy:", error);
  process.exit(1);
});
