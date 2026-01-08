/**
 * CDN Artifact Proxy entry point.
 * HTTP server for serving Mermaid artifacts from S3/MinIO or local filesystem storage.
 */

import http from "node:http";
import { loadCdnProxyConfig } from "./config.js";
import { parseRoute } from "./router.js";
import { sendError } from "./errors.js";
import { createRequestContext, getDurationMs } from "./middleware.js";
import { logRequest, createLogEntry, logStartup, logReady } from "./logger.js";
import { handleHealth } from "./handlers/health.js";
import { handleArtifact } from "./handlers/artifact.js";
import { handleLocalFile } from "./handlers/local-file-handler.js";
import { createS3Fetcher } from "./s3-fetcher.js";
import { createLocalFetcher } from "./local-fetcher.js";
import { createCache } from "./cache.js";
import { createStorageBackend } from "../storage/factory.js";
import type { LocalStorageBackend } from "../storage/local-backend.js";

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

  // Create storage backend and fetchers based on storage type
  let s3Fetcher = null;
  let localFetcher = null;
  let storageBackend = null;

  if (config.storageType === "s3" && config.s3.configured) {
    s3Fetcher = createS3Fetcher({
      endpoint: config.s3.endpoint,
      bucket: config.s3.bucket,
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      region: config.s3.region,
    });
  } else if (config.storageType === "local" && config.localStoragePath) {
    // Create storage backend for local storage
    storageBackend = await createStorageBackend();
    if (storageBackend.getType() === "local") {
      localFetcher = createLocalFetcher(
        storageBackend as LocalStorageBackend,
        config.localStoragePath,
      );
    }
  } else if (config.storageType === "unknown") {
    // Fail fast when storage type is unknown
    const message =
      "Storage configuration is ambiguous or missing. " +
      "Either configure local storage (CONTAINER_STORAGE_PATH) or S3 (S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY), but not both. " +
      "Or set STORAGE_TYPE explicitly to 'local' or 's3'.";
    console.error(
      JSON.stringify({
        level: "error",
        message,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new Error(message);
  }

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
            localStorageBackend: storageBackend as LocalStorageBackend | null,
            cache,
            getUptimeSeconds,
            storageType: config.storageType,
          });
          break;

        case "artifact":
          // Route based on storage type and artifact path format
          // Local storage uses /artifacts/{session}/{uuid}.{ext}
          // S3 storage uses /artifacts/{uuid}.{ext}
          if (route.artifact.sessionId && config.storageType === "local") {
            // Local storage request
            if (localFetcher) {
              await handleLocalFile(res, ctx, route.artifact, {
                localFetcher,
              });
            } else {
              sendError(res, "NOT_CONFIGURED", ctx.path, ctx.requestId);
              logRequest(
                createLogEntry({
                  request_id: ctx.requestId,
                  method: ctx.method,
                  path: ctx.path,
                  status: 503,
                  duration_ms: getDurationMs(ctx),
                  cache: "disabled",
                  error: "NOT_CONFIGURED",
                }),
              );
            }
          } else {
            // S3 storage request (legacy format or S3 backend)
            await handleArtifact(res, ctx, route.artifact, {
              config,
              s3Fetcher,
              cache,
            });
          }
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
      // Extract error details for structured logging
      const errorDetails =
        error instanceof Error
          ? `${error.name}: ${error.message}\n${error.stack ?? "No stack trace"}`
          : String(error);

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
          error_details: errorDetails,
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
