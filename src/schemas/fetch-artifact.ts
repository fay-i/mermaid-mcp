/**
 * Schemas for fetch_artifact MCP tool.
 * Per contracts/fetch-artifact.json specification.
 * T028, T029: Input and output schemas.
 */

import { z } from "zod";

/**
 * Input schema for fetch_artifact tool.
 */
export const FetchArtifactInputSchema = z.object({
  /** The unique identifier of the artifact to retrieve */
  artifact_id: z.string(),
  /** Output encoding. Use 'utf8' for text formats like SVG, 'base64' for binary formats like PDF */
  encoding: z.enum(["base64", "utf8"]).optional().default("base64"),
});

export type FetchArtifactInput = z.infer<typeof FetchArtifactInputSchema>;

/**
 * Error codes for fetch_artifact.
 */
export const FetchArtifactErrorCodeSchema = z.enum([
  "ARTIFACT_NOT_FOUND",
  "SESSION_MISMATCH",
  "CACHE_UNAVAILABLE",
  "INVALID_ARTIFACT_ID",
]);

export type FetchArtifactErrorCode = z.infer<
  typeof FetchArtifactErrorCodeSchema
>;

/**
 * Error object for fetch_artifact failures.
 */
export const FetchArtifactErrorSchema = z.object({
  code: FetchArtifactErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type FetchArtifactError = z.infer<typeof FetchArtifactErrorSchema>;

/**
 * Success response for fetch_artifact.
 */
export const FetchArtifactSuccessOutputSchema = z.object({
  ok: z.literal(true),
  content: z.string(),
  content_type: z.enum(["image/svg+xml", "application/pdf"]),
  size_bytes: z.number().int().positive(),
  encoding: z.enum(["base64", "utf8"]),
});

export type FetchArtifactSuccessOutput = z.infer<
  typeof FetchArtifactSuccessOutputSchema
>;

/**
 * Error response for fetch_artifact.
 */
export const FetchArtifactErrorOutputSchema = z.object({
  ok: z.literal(false),
  errors: z.array(FetchArtifactErrorSchema).min(1),
});

export type FetchArtifactErrorOutput = z.infer<
  typeof FetchArtifactErrorOutputSchema
>;

/**
 * Combined output type.
 */
export type FetchArtifactOutput =
  | FetchArtifactSuccessOutput
  | FetchArtifactErrorOutput;
