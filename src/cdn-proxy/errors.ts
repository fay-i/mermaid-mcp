/**
 * Error response helpers for CDN Proxy.
 * Creates structured error responses per the OpenAPI contract.
 */

import type { ServerResponse } from "node:http";
import type { ErrorResponse, CdnErrorCode } from "./types.js";

/**
 * Error code to HTTP status mapping.
 */
const ERROR_STATUS_MAP: Record<CdnErrorCode, number> = {
  ARTIFACT_NOT_FOUND: 404,
  INVALID_PATH: 400,
  S3_ERROR: 502,
  NOT_CONFIGURED: 503,
  PERMISSION_DENIED: 403,
  INTERNAL_ERROR: 500,
};

/**
 * Human-readable error messages.
 */
const ERROR_MESSAGES: Record<CdnErrorCode, string> = {
  ARTIFACT_NOT_FOUND: "Artifact does not exist",
  INVALID_PATH: "Invalid artifact path format",
  S3_ERROR: "Failed to retrieve artifact from storage",
  NOT_CONFIGURED: "S3 storage is not configured",
  PERMISSION_DENIED: "Permission denied accessing artifact",
  INTERNAL_ERROR: "An unexpected error occurred",
};

/**
 * Create an error response body.
 */
export function createErrorResponse(
  code: CdnErrorCode,
  path: string,
  requestId: string,
  customMessage?: string,
): ErrorResponse {
  return {
    error: code,
    message: customMessage ?? ERROR_MESSAGES[code],
    path,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send an error response to the client.
 */
export function sendError(
  res: ServerResponse,
  code: CdnErrorCode,
  path: string,
  requestId: string,
  customMessage?: string,
): void {
  const status = ERROR_STATUS_MAP[code];
  const body = createErrorResponse(code, path, requestId, customMessage);

  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  });
  res.end(JSON.stringify(body));
}

/**
 * Get the HTTP status code for an error code.
 */
export function getErrorStatus(code: CdnErrorCode): number {
  return ERROR_STATUS_MAP[code];
}
