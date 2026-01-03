/**
 * Artifact endpoint handler for CDN Proxy.
 */

import type { ServerResponse } from "node:http";
import type { RequestContext } from "../middleware.js";
import type { ArtifactRef, CdnProxyConfig, CacheEntry } from "../types.js";
import type { S3Fetcher } from "../s3-fetcher.js";
import type { ArtifactCache } from "../cache.js";
import { sendError } from "../errors.js";
import { logRequest, createLogEntry } from "../logger.js";
import { getDurationMs } from "../middleware.js";
import { artifactToS3Key, getContentType } from "../router.js";
import { isNotFoundError } from "../s3-fetcher.js";

/**
 * Artifact handler dependencies.
 */
export interface ArtifactHandlerDeps {
  config: CdnProxyConfig;
  s3Fetcher: S3Fetcher | null;
  cache: ArtifactCache | null;
}

/**
 * Cache status for response headers.
 */
type CacheStatus = "hit" | "miss" | "bypass" | "disabled";

/**
 * Handle GET /artifacts/{artifactId}.{ext} requests.
 */
export async function handleArtifact(
  res: ServerResponse,
  ctx: RequestContext,
  artifact: ArtifactRef,
  deps: ArtifactHandlerDeps,
): Promise<void> {
  const s3Key = artifactToS3Key(artifact);
  const expectedContentType = getContentType(artifact.extension);

  // Check if S3 is configured
  if (!deps.s3Fetcher) {
    sendError(res, "NOT_CONFIGURED", ctx.path, ctx.requestId);
    logRequest(
      createLogEntry({
        request_id: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        status: 503,
        duration_ms: getDurationMs(ctx),
        cache: "disabled",
        artifact_id: artifact.artifactId,
        error: "NOT_CONFIGURED",
      }),
    );
    return;
  }

  let cacheStatus: CacheStatus = deps.cache ? "miss" : "disabled";
  let cacheEntry: CacheEntry | undefined;

  // Try cache first
  if (deps.cache) {
    cacheEntry = deps.cache.get(s3Key);
    if (cacheEntry) {
      cacheStatus = "hit";
    } else {
      // Check for in-flight request (request coalescing)
      const inFlightPromise = deps.cache.getInFlight(s3Key);
      if (inFlightPromise) {
        try {
          cacheEntry = await inFlightPromise;
          cacheStatus = "hit";
        } catch {
          // In-flight request failed, proceed with fresh fetch
        }
      }
    }
  }

  // Capture s3Fetcher for use in closure (already checked non-null above)
  const s3Fetcher = deps.s3Fetcher;

  // If not in cache, fetch from S3
  if (!cacheEntry) {
    try {
      // Create fetch promise for potential coalescing
      const fetchPromise = (async () => {
        const result = await s3Fetcher.fetch(s3Key);

        const entry: CacheEntry = {
          content: result.content,
          contentType: expectedContentType,
          sizeBytes: result.contentLength,
          cachedAt: Date.now(),
          s3Metadata: {
            etag: result.etag,
            lastModified: result.lastModified,
          },
        };

        return entry;
      })();

      // Register in-flight request if caching is enabled
      if (deps.cache) {
        deps.cache.setInFlight(s3Key, fetchPromise);
      }

      try {
        cacheEntry = await fetchPromise;

        // Cache the result if appropriate
        if (deps.cache) {
          const cached = deps.cache.set(s3Key, cacheEntry);
          if (!cached) {
            cacheStatus = "bypass"; // Too large for cache
          }
        }
      } finally {
        // Remove in-flight tracking
        if (deps.cache) {
          deps.cache.removeInFlight(s3Key);
        }
      }
    } catch (error) {
      // Handle S3 errors
      if (isNotFoundError(error)) {
        sendError(res, "ARTIFACT_NOT_FOUND", ctx.path, ctx.requestId);
        logRequest(
          createLogEntry({
            request_id: ctx.requestId,
            method: ctx.method,
            path: ctx.path,
            status: 404,
            duration_ms: getDurationMs(ctx),
            cache: cacheStatus,
            artifact_id: artifact.artifactId,
            error: "ARTIFACT_NOT_FOUND",
          }),
        );
        return;
      }

      // Other S3 errors
      sendError(res, "S3_ERROR", ctx.path, ctx.requestId);
      logRequest(
        createLogEntry({
          request_id: ctx.requestId,
          method: ctx.method,
          path: ctx.path,
          status: 502,
          duration_ms: getDurationMs(ctx),
          cache: cacheStatus,
          artifact_id: artifact.artifactId,
          error: "S3_ERROR",
        }),
      );
      return;
    }
  }

  // Send successful response
  const headers: Record<string, string | number> = {
    "Content-Type": cacheEntry.contentType,
    "Content-Length": cacheEntry.sizeBytes,
    "Cache-Control": "public, max-age=86400",
    "X-Artifact-Id": artifact.artifactId,
    "X-Cache": cacheStatus.toUpperCase(),
    "X-Request-Id": ctx.requestId,
  };

  // Include ETag if available
  if (cacheEntry.s3Metadata.etag) {
    headers.ETag = cacheEntry.s3Metadata.etag;
  }

  res.writeHead(200, headers);
  res.end(cacheEntry.content);

  logRequest(
    createLogEntry({
      request_id: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      status: 200,
      duration_ms: getDurationMs(ctx),
      cache: cacheStatus,
      artifact_id: artifact.artifactId,
      size_bytes: cacheEntry.sizeBytes,
    }),
  );
}
