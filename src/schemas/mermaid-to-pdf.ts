import { z } from "zod";
import {
  WarningSchema,
  CacheWarningSchema,
  type Warning,
} from "./mermaid-to-svg.js";
import {
  ErrorCodeSchema,
  RenderErrorSchema,
  type ErrorCode,
  type RenderError,
} from "./error-codes.js";
import { ArtifactRefSchema } from "./artifact-ref.js";

// Re-export shared types
export { WarningSchema, RenderErrorSchema, type Warning, type RenderError };

/**
 * PDF error code schema - uses the shared error code schema.
 * PDF_GENERATION_FAILED is included in the shared schema.
 */
export const PdfErrorCodeSchema = ErrorCodeSchema;

export type PdfErrorCode = ErrorCode;

/**
 * Error object for PDF render failures.
 * Uses the shared error schema.
 */
export const PdfRenderErrorSchema = RenderErrorSchema;

export type PdfRenderError = RenderError;

/**
 * Input schema for the mermaid_to_pdf MCP tool.
 * Validates Mermaid diagram code and optional rendering parameters.
 * Identical to mermaid_to_svg input for consistency.
 */
export const MermaidToPdfInputSchema = z.object({
  /** Mermaid diagram source code (1 byte to 1MB) */
  code: z.string().min(1).max(1_048_576),
  /** Diagram color theme */
  theme: z.enum(["default", "dark", "forest", "neutral"]).optional(),
  /** Background color (CSS color value or 'transparent') */
  background: z.string().optional(),
  /** Advanced Mermaid configuration as JSON string */
  config_json: z.string().optional(),
  /** Render timeout in milliseconds (1000-120000) */
  timeout_ms: z.number().int().min(1000).max(120000).optional(),
});

export type MermaidToPdfInput = z.infer<typeof MermaidToPdfInputSchema>;

/**
 * Success response for mermaid_to_pdf tool.
 * ok=true, contains pdf (base64), errors array must be empty.
 */
export const MermaidToPdfSuccessOutputSchema = z.object({
  ok: z.literal(true),
  /** Unique request identifier for correlation */
  request_id: z.string().uuid(),
  /** Base64-encoded PDF document */
  pdf: z.string(),
  /** Non-fatal warnings (may be empty) */
  warnings: z.array(WarningSchema),
  /** Empty array for success responses */
  errors: z.array(PdfRenderErrorSchema).max(0),
});

export type MermaidToPdfSuccessOutput = z.infer<
  typeof MermaidToPdfSuccessOutputSchema
>;

/**
 * Error response for mermaid_to_pdf tool.
 * ok=false, NO pdf field, errors array has at least one error.
 */
export const MermaidToPdfErrorOutputSchema = z
  .object({
    ok: z.literal(false),
    /** Unique request identifier for correlation */
    request_id: z.string().uuid(),
    /** Non-fatal warnings (may be empty) */
    warnings: z.array(WarningSchema),
    /** Array of errors (at least one for error responses) */
    errors: z.array(PdfRenderErrorSchema).min(1),
  })
  .strict();

export type MermaidToPdfErrorOutput = z.infer<
  typeof MermaidToPdfErrorOutputSchema
>;

/**
 * Output schema for the mermaid_to_pdf MCP tool.
 * Discriminated union: success (ok=true) or error (ok=false).
 */
export const MermaidToPdfOutputSchema = z.discriminatedUnion("ok", [
  MermaidToPdfSuccessOutputSchema,
  MermaidToPdfErrorOutputSchema,
]);

export type MermaidToPdfOutput = z.infer<typeof MermaidToPdfOutputSchema>;

// ============================================
// Cached output schemas (T020)
// Per contracts/mermaid-to-pdf-cached.json
// ============================================

/**
 * Success response with artifact reference (cached mode).
 */
export const MermaidToPdfCachedSuccessOutputSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  artifact: ArtifactRefSchema,
  mode: z.literal("cached"),
  warnings: z.array(CacheWarningSchema),
  errors: z.array(PdfRenderErrorSchema).max(0),
});

export type MermaidToPdfCachedSuccessOutput = z.infer<
  typeof MermaidToPdfCachedSuccessOutputSchema
>;

/**
 * Success response with inline content (fallback mode).
 */
export const MermaidToPdfInlineSuccessOutputSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  pdf_base64: z.string(),
  mode: z.literal("inline"),
  warnings: z.array(CacheWarningSchema),
  errors: z.array(PdfRenderErrorSchema).max(0),
});

export type MermaidToPdfInlineSuccessOutput = z.infer<
  typeof MermaidToPdfInlineSuccessOutputSchema
>;

/**
 * Error response (same structure for both modes).
 */
export const MermaidToPdfCachedErrorOutputSchema = z.object({
  ok: z.literal(false),
  request_id: z.string().uuid(),
  warnings: z.array(CacheWarningSchema),
  errors: z.array(PdfRenderErrorSchema).min(1),
});

export type MermaidToPdfCachedErrorOutput = z.infer<
  typeof MermaidToPdfCachedErrorOutputSchema
>;

/**
 * Combined cached output type (success cached | success inline | error).
 */
export type MermaidToPdfCachedOutput =
  | MermaidToPdfCachedSuccessOutput
  | MermaidToPdfInlineSuccessOutput
  | MermaidToPdfCachedErrorOutput;
