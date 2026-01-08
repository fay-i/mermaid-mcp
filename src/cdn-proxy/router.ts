/**
 * Request router for CDN Proxy.
 * Parses URL paths and routes to appropriate handlers.
 */

import type { ArtifactRef } from "./types.js";

/**
 * UUID regex pattern for artifact IDs.
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * S3 artifact path regex (legacy format).
 * Matches: /artifacts/{uuid}.{svg|pdf}
 */
const S3_ARTIFACT_PATH_PATTERN =
  /^\/artifacts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(svg|pdf)$/i;

/**
 * Local storage artifact path regex (session-based format).
 * Matches: /artifacts/{sessionId}/{uuid}.{svg|pdf}
 */
const LOCAL_ARTIFACT_PATH_PATTERN =
  /^\/artifacts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(svg|pdf)$/i;

/**
 * Route types for the CDN proxy.
 */
export type RouteType = "health" | "artifact" | "not_found" | "invalid_path";

/**
 * Routing result with parsed parameters.
 */
export type RouteResult =
  | { type: "health" }
  | { type: "artifact"; artifact: ArtifactRef }
  | { type: "not_found" }
  | { type: "invalid_path" };

/**
 * Parse a request path and determine the route.
 * Supports both S3 format (/artifacts/{uuid}.{ext}) and local format (/artifacts/{session}/{uuid}.{ext}).
 */
export function parseRoute(path: string): RouteResult {
  // Health endpoint
  if (path === "/health") {
    return { type: "health" };
  }

  // Check if it looks like an artifact path
  if (path.startsWith("/artifacts/")) {
    // Try local storage format first (session-based): /artifacts/{session}/{uuid}.{ext}
    const localMatch = path.match(LOCAL_ARTIFACT_PATH_PATTERN);
    if (localMatch) {
      return {
        type: "artifact",
        artifact: {
          sessionId: localMatch[1].toLowerCase(),
          artifactId: localMatch[2].toLowerCase(),
          extension: localMatch[3].toLowerCase() as "svg" | "pdf",
        },
      };
    }

    // Try S3 format (legacy): /artifacts/{uuid}.{ext}
    const s3Match = path.match(S3_ARTIFACT_PATH_PATTERN);
    if (s3Match) {
      return {
        type: "artifact",
        artifact: {
          artifactId: s3Match[1].toLowerCase(),
          extension: s3Match[2].toLowerCase() as "svg" | "pdf",
        },
      };
    }

    // Path starts with /artifacts/ but doesn't match either pattern
    return { type: "invalid_path" };
  }

  // Unknown path
  return { type: "not_found" };
}

/**
 * Validate that an artifact ID is a valid UUID.
 */
export function isValidUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}

/**
 * Convert an artifact reference to an S3 key.
 */
export function artifactToS3Key(artifact: ArtifactRef): string {
  return `${artifact.artifactId}.${artifact.extension}`;
}

/**
 * Get the content type for an extension.
 */
export function getContentType(
  extension: "svg" | "pdf",
): "image/svg+xml" | "application/pdf" {
  return extension === "svg" ? "image/svg+xml" : "application/pdf";
}
