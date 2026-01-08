/**
 * Output schemas for the mermaid_to_deck MCP tool.
 * Defines success and error response structures.
 */

import { z } from "zod";
import { RenderErrorSchema } from "./error-codes.js";

/**
 * Detected Mermaid diagram types.
 */
export const DiagramTypeSchema = z.enum([
  "flowchart",
  "sequence",
  "class",
  "state",
  "er",
  "journey",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "quadrant",
  "git",
  "unknown",
]);

export type DiagramType = z.infer<typeof DiagramTypeSchema>;

/**
 * Metadata for a single page in the deck.
 */
export const PageMetadataSchema = z.object({
  /** Zero-based page index */
  index: z.number().int().min(0),
  /** Title if provided in input */
  title: z.string().optional(),
  /** Detected Mermaid diagram type */
  diagram_type: DiagramTypeSchema,
});

export type PageMetadata = z.infer<typeof PageMetadataSchema>;

/**
 * S3 storage location details.
 */
export const S3LocationSchema = z.object({
  /** S3 bucket name */
  bucket: z.string(),
  /** Object key (artifact_id.pdf) */
  key: z.string(),
  /** AWS region */
  region: z.string(),
});

export type S3Location = z.infer<typeof S3LocationSchema>;

/**
 * Warning object for non-fatal issues.
 */
export const WarningSchema = z.object({
  /** Warning code */
  code: z.string(),
  /** Human-readable warning message */
  message: z.string(),
});

export type Warning = z.infer<typeof WarningSchema>;

/**
 * Extended render error with diagram-specific context.
 */
export const DeckRenderErrorSchema = RenderErrorSchema.extend({
  details: z
    .object({
      /** Index of failing diagram (0-based) */
      diagram_index: z.number().int().min(0).optional(),
      /** Line number for parse errors */
      line: z.number().int().min(1).optional(),
    })
    .passthrough()
    .optional(),
});

export type DeckRenderError = z.infer<typeof DeckRenderErrorSchema>;

/**
 * Successful deck generation response.
 */
export const DeckSuccessResponseSchema = z.object({
  /** Success indicator */
  ok: z.literal(true),
  /** Unique request identifier (UUID) */
  request_id: z.string().uuid(),
  /** Generated artifact ID (UUID) */
  artifact_id: z.string().uuid(),
  /** Download URL (file:// for local, https:// for S3) */
  download_url: z.string().url(),
  /** CDN URL (when configured) */
  cdn_url: z.string().url().optional(),
  /** Ready-to-use download command */
  curl_command: z.string(),
  /** Storage backend type */
  storage_type: z.enum(["local", "s3"]),
  /** S3 location details (S3 only) */
  s3: S3LocationSchema.optional(),
  /** URL expiration time in seconds (S3 only) */
  expires_in_seconds: z.number().int().positive().optional(),
  /** MIME type (always application/pdf) */
  content_type: z.literal("application/pdf"),
  /** PDF file size in bytes */
  size_bytes: z.number().int().min(0),
  /** Number of pages in deck */
  page_count: z.number().int().min(1).max(100),
  /** Per-page metadata */
  pages: z.array(PageMetadataSchema).min(1).max(100),
  /** Non-fatal warnings (may be empty) */
  warnings: z.array(WarningSchema),
  /** Empty for success responses */
  errors: z.array(DeckRenderErrorSchema).max(0),
});

export type DeckSuccessResponse = z.infer<typeof DeckSuccessResponseSchema>;

/**
 * Failed deck generation response.
 */
export const DeckErrorResponseSchema = z.object({
  /** Failure indicator */
  ok: z.literal(false),
  /** Unique request identifier (UUID) */
  request_id: z.string().uuid(),
  /** Non-fatal warnings */
  warnings: z.array(WarningSchema),
  /** At least one error */
  errors: z.array(DeckRenderErrorSchema).min(1),
});

export type DeckErrorResponse = z.infer<typeof DeckErrorResponseSchema>;

/**
 * Union type for deck generation output.
 */
export const DeckResponseSchema = z.discriminatedUnion("ok", [
  DeckSuccessResponseSchema,
  DeckErrorResponseSchema,
]);

export type DeckResponse = z.infer<typeof DeckResponseSchema>;
