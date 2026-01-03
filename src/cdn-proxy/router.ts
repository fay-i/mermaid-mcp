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
 * Artifact path regex.
 * Matches: /artifacts/{uuid}.{svg|pdf}
 */
const ARTIFACT_PATH_PATTERN =
  /^\/artifacts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(svg|pdf)$/i;

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
 */
export function parseRoute(path: string): RouteResult {
  // Health endpoint
  if (path === "/health") {
    return { type: "health" };
  }

  // Check if it looks like an artifact path
  if (path.startsWith("/artifacts/")) {
    const match = path.match(ARTIFACT_PATH_PATTERN);
    if (match) {
      return {
        type: "artifact",
        artifact: {
          artifactId: match[1].toLowerCase(),
          extension: match[2].toLowerCase() as "svg" | "pdf",
        },
      };
    }
    // Path starts with /artifacts/ but doesn't match the pattern
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
