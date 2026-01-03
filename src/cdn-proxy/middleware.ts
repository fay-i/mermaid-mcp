/**
 * HTTP middleware for CDN Proxy.
 * Provides request ID generation and timing utilities.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Request context with ID and timing information.
 */
export interface RequestContext {
  /** Unique request ID (UUID) */
  requestId: string;

  /** Request start time for duration calculation */
  startTime: number;

  /** Request path */
  path: string;

  /** HTTP method */
  method: string;
}

/**
 * Create a request context with a new UUID and start time.
 */
export function createRequestContext(req: IncomingMessage): RequestContext {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  return {
    requestId: randomUUID(),
    startTime: Date.now(),
    path: url.pathname,
    method: req.method ?? "GET",
  };
}

/**
 * Calculate request duration in milliseconds.
 */
export function getDurationMs(ctx: RequestContext): number {
  return Date.now() - ctx.startTime;
}
