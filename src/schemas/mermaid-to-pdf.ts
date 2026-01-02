import { z } from "zod";
import {
  WarningSchema,
  RenderErrorSchema,
  ErrorCodeSchema,
  type Warning,
  type RenderError,
} from "./mermaid-to-svg.js";

// Re-export shared types
export { WarningSchema, RenderErrorSchema, type Warning, type RenderError };

/**
 * Extended error codes for mermaid_to_pdf tool.
 * Adds PDF_GENERATION_FAILED to the existing SVG error codes.
 */
export const PdfErrorCodeSchema = z.enum([
  ...ErrorCodeSchema.options,
  "PDF_GENERATION_FAILED",
]);

export type PdfErrorCode = z.infer<typeof PdfErrorCodeSchema>;

/**
 * Error object for PDF render failures.
 * Uses extended error codes.
 */
export const PdfRenderErrorSchema = z.object({
  /** Stable error code (includes PDF-specific codes) */
  code: PdfErrorCodeSchema,
  /** Human-readable error description */
  message: z.string(),
  /** Additional context (e.g., line/column for parse errors) */
  details: z.record(z.string(), z.unknown()).optional(),
});

export type PdfRenderError = z.infer<typeof PdfRenderErrorSchema>;

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
