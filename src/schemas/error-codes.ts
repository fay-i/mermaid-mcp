/**
 * Shared error codes for all rendering operations.
 * Single source of truth for error codes across SVG, PDF, and S3 operations.
 */

import { z } from "zod";

/**
 * Complete set of stable error codes for render failures.
 * Used by all tools and output schemas.
 */
export const ErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INPUT_TOO_LARGE",
  "PARSE_ERROR",
  "UNSUPPORTED_DIAGRAM",
  "INVALID_CONFIG",
  "INVALID_TIMEOUT",
  "RENDER_TIMEOUT",
  "RENDER_FAILED",
  "STORAGE_FAILED",
  "PDF_GENERATION_FAILED",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Error object for render failures.
 */
export const RenderErrorSchema = z.object({
  /** Stable error code */
  code: ErrorCodeSchema,
  /** Human-readable error description */
  message: z.string(),
  /** Additional context (e.g., line/column for parse errors) */
  details: z.record(z.string(), z.unknown()).optional(),
});

export type RenderError = z.infer<typeof RenderErrorSchema>;
