/**
 * Schema for S3-backed artifact output.
 * Used by mermaid_to_svg and mermaid_to_pdf when S3 storage is enabled.
 */

import { z } from "zod";

/**
 * Warning object for non-fatal issues.
 */
export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type Warning = z.infer<typeof WarningSchema>;

/**
 * Error codes for render failures.
 */
export const ErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INPUT_TOO_LARGE",
  "INVALID_TIMEOUT",
  "INVALID_CONFIG",
  "PARSE_ERROR",
  "RENDER_FAILED",
  "RENDER_TIMEOUT",
  "STORAGE_FAILED",
  "PDF_GENERATION_FAILED",
  "UNSUPPORTED_DIAGRAM",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Error object for render failures.
 */
export const RenderErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type RenderError = z.infer<typeof RenderErrorSchema>;

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
 * Success output with S3 artifact reference and presigned URL.
 */
export const ArtifactSuccessOutputSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  /** Presigned download URL - use with curl */
  download_url: z.string().url(),
  /** Ready-to-use curl command */
  curl_command: z.string(),
  /** S3 location for aws-cli access */
  s3: S3LocationSchema,
  expires_in_seconds: z.number().int().positive(),
  content_type: z.enum(["image/svg+xml", "application/pdf"]),
  size_bytes: z.number().int().nonnegative(),
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
