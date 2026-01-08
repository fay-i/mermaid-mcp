/**
 * Schema for S3-backed artifact output.
 * Used by mermaid_to_svg and mermaid_to_pdf when S3 storage is enabled.
 */

import { z } from "zod";
import {
  ErrorCodeSchema,
  RenderErrorSchema,
  type ErrorCode,
  type RenderError,
} from "./error-codes.js";

// Re-export for backwards compatibility
export { ErrorCodeSchema, RenderErrorSchema, type ErrorCode, type RenderError };

/**
 * Warning object for non-fatal issues.
 */
export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type Warning = z.infer<typeof WarningSchema>;

/**
 * S3 location info for aws-cli access.
 */
export const S3LocationSchema = z.object({
  bucket: z.string(),
  key: z.string(),
  region: z.string(),
});

export type S3Location = z.infer<typeof S3LocationSchema>;

/**
 * Success output with artifact reference and download URL.
 * Supports both local (file://) and S3 (https://) storage backends.
 */
export const ArtifactSuccessOutputSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  /** Download URL (file:// for local, https:// for S3) - use with curl */
  download_url: z.string().url(),
  /** Ready-to-use curl command */
  curl_command: z.string(),
  /** Storage backend type */
  storage_type: z.enum(["local", "s3"]),
  /** S3 location for aws-cli access (S3 only) */
  s3: S3LocationSchema.optional(),
  /** Presigned URL expiry in seconds (S3 only) */
  expires_in_seconds: z.number().int().positive().optional(),
  content_type: z.enum(["image/svg+xml", "application/pdf"]),
  size_bytes: z.number().int().nonnegative(),
  /** CDN URL for artifact access (when CDN proxy is configured) */
  cdn_url: z.string().url().optional(),
  warnings: z.array(WarningSchema),
  errors: z.array(RenderErrorSchema).max(0),
});

export type ArtifactSuccessOutput = z.infer<typeof ArtifactSuccessOutputSchema>;

/**
 * Error output for failed renders.
 */
export const ArtifactErrorOutputSchema = z.object({
  ok: z.literal(false),
  request_id: z.string().uuid(),
  warnings: z.array(WarningSchema),
  errors: z.array(RenderErrorSchema).min(1),
});

export type ArtifactErrorOutput = z.infer<typeof ArtifactErrorOutputSchema>;

/**
 * Combined output type (success or error).
 */
export const ArtifactOutputSchema = z.discriminatedUnion("ok", [
  ArtifactSuccessOutputSchema,
  ArtifactErrorOutputSchema,
]);

export type ArtifactOutput = z.infer<typeof ArtifactOutputSchema>;
