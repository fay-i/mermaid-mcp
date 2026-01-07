/**
 * Local File Handler for CDN Proxy
 * Feature: 010-local-disk-storage
 *
 * Handles GET requests for artifacts stored in local filesystem.
 */

import type { ServerResponse } from "node:http";
import type { RequestContext } from "../middleware.js";
import type { ArtifactRef } from "../types.js";
import type { LocalFetcher } from "../local-fetcher.js";
import { sendError } from "../errors.js";
import { logRequest, createLogEntry } from "../logger.js";
import { getDurationMs } from "../middleware.js";
import { getContentType } from "../router.js";

/**
 * Local file handler dependencies.
 */
export interface LocalFileHandlerDeps {
  localFetcher: LocalFetcher;
}

/**
 * Handle GET /artifacts/{sessionId}/{artifactId}.{ext} requests for local storage.
 * Per FR-013a: Range headers are ignored, always returns full content with 200 OK.
 */
export async function handleLocalFile(
  res: ServerResponse,
  ctx: RequestContext,
  artifact: ArtifactRef,
  deps: LocalFileHandlerDeps,
): Promise<void> {
  // Validate that sessionId is present (required for local storage)
  if (!artifact.sessionId) {
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
    return;
  }

  const expectedContentType = getContentType(artifact.extension);

  try {
    // Fetch file from local storage
    const result = await deps.localFetcher.fetch(
      artifact.sessionId,
      artifact.artifactId,
      artifact.extension,
    );

    // Per FR-013a: Ignore Range headers, always return full content with 200 OK
    const headers: Record<string, string | number> = {
      "Content-Type": expectedContentType,
      "Content-Length": result.contentLength,
      "Cache-Control": "public, max-age=86400",
      "X-Artifact-Id": artifact.artifactId,
      "X-Session-Id": artifact.sessionId,
      "X-Request-Id": ctx.requestId,
      "X-Storage-Backend": "local",
    };

    // Include Last-Modified header if available
    if (result.lastModified) {
      headers["Last-Modified"] = result.lastModified.toUTCString();
    }

    res.writeHead(200, headers);
    res.end(result.content);

    logRequest(
      createLogEntry({
        request_id: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        status: 200,
        duration_ms: getDurationMs(ctx),
        cache: "disabled",
        artifact_id: artifact.artifactId,
        size_bytes: result.contentLength,
      }),
    );
  } catch (error) {
    // Handle file not found (404)
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      sendError(res, "ARTIFACT_NOT_FOUND", ctx.path, ctx.requestId);
      logRequest(
        createLogEntry({
          request_id: ctx.requestId,
          method: ctx.method,
          path: ctx.path,
          status: 404,
          duration_ms: getDurationMs(ctx),
          cache: "disabled",
          artifact_id: artifact.artifactId,
          error: "ARTIFACT_NOT_FOUND",
        }),
      );
      return;
    }

    // Handle permission denied (403)
    if (nodeError.code === "EACCES") {
      sendError(res, "PERMISSION_DENIED", ctx.path, ctx.requestId);
      logRequest(
        createLogEntry({
          request_id: ctx.requestId,
          method: ctx.method,
          path: ctx.path,
          status: 403,
          duration_ms: getDurationMs(ctx),
          cache: "disabled",
          artifact_id: artifact.artifactId,
          error: "PERMISSION_DENIED",
        }),
      );
      return;
    }

    // Other errors (500)
    sendError(res, "INTERNAL_ERROR", ctx.path, ctx.requestId);
    logRequest(
      createLogEntry({
        request_id: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        status: 500,
        duration_ms: getDurationMs(ctx),
        cache: "disabled",
        artifact_id: artifact.artifactId,
        error: "INTERNAL_ERROR",
        error_details:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      }),
    );
  }
}
