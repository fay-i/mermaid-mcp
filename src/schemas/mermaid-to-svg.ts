import { z } from "zod";
import { ArtifactRefSchema } from "./artifact-ref.js";
import {
  ErrorCodeSchema,
  RenderErrorSchema,
  type ErrorCode,
  type RenderError,
} from "./error-codes.js";

// Re-export for backwards compatibility
export { ErrorCodeSchema, RenderErrorSchema, type ErrorCode, type RenderError };

/**
 * Input schema for the mermaid_to_svg MCP tool.
 * Validates Mermaid diagram code and optional rendering parameters.
 */
export const MermaidToSvgInputSchema = z.object({
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
  /** Apply drop shadow to nodes and clusters (default: true) */
  drop_shadow: z.boolean().default(true),
  /** Google Font to load (default: "Source Code Pro") */
  google_font: z.string().default("Source Code Pro"),
});

export type MermaidToSvgInput = z.infer<typeof MermaidToSvgInputSchema>;

/**
 * Warning object for non-fatal issues.
 */
export const WarningSchema = z.object({
  /** Warning identifier */
  code: z.string(),
  /** Human-readable warning description */
  message: z.string(),
});

export type Warning = z.infer<typeof WarningSchema>;

/**
 * Success response for mermaid_to_svg tool.
 * ok=true, contains svg, errors array must be empty.
 */
export const MermaidToSvgSuccessOutputSchema = z.object({
  ok: z.literal(true),
  /** Unique request identifier for correlation */
  request_id: z.string().uuid(),
  /** Valid SVG 1.1 markup */
  svg: z.string(),
  /** Non-fatal warnings (may be empty) */
  warnings: z.array(WarningSchema),
  /** Empty array for success responses */
  errors: z.array(RenderErrorSchema).max(0),
});

export type MermaidToSvgSuccessOutput = z.infer<
  typeof MermaidToSvgSuccessOutputSchema
>;

/**
 * Error response for mermaid_to_svg tool.
 * ok=false, NO svg field, errors array has at least one error.
 */
export const MermaidToSvgErrorOutputSchema = z
  .object({
    ok: z.literal(false),
    /** Unique request identifier for correlation */
    request_id: z.string().uuid(),
    /** Non-fatal warnings (may be empty) */
    warnings: z.array(WarningSchema),
    /** Array of errors (at least one for error responses) */
    errors: z.array(RenderErrorSchema).min(1),
  })
  .strict();

export type MermaidToSvgErrorOutput = z.infer<
  typeof MermaidToSvgErrorOutputSchema
>;

/**
 * Output schema for the mermaid_to_svg MCP tool (original inline mode).
 * Discriminated union: success (ok=true) or error (ok=false).
 */
export const MermaidToSvgOutputSchema = z.discriminatedUnion("ok", [
  MermaidToSvgSuccessOutputSchema,
  MermaidToSvgErrorOutputSchema,
]);

export type MermaidToSvgOutput = z.infer<typeof MermaidToSvgOutputSchema>;

// ============================================
// Cached output schemas (T018)
// Per contracts/mermaid-to-svg-cached.json
// ============================================

/**
 * Warning codes specific to caching.
 */
export const CacheWarningCodeSchema = z.enum([
  "CACHE_UNAVAILABLE",
  "CACHE_WRITE_FAILED",
  "QUOTA_EXCEEDED",
]);

export type CacheWarningCode = z.infer<typeof CacheWarningCodeSchema>;

/**
 * Cache-specific warning object.
 */
export const CacheWarningSchema = z.object({
  code: CacheWarningCodeSchema,
  message: z.string(),
});

export type CacheWarning = z.infer<typeof CacheWarningSchema>;

/**
 * Success response with artifact reference (cached mode).
 */
export const MermaidToSvgCachedSuccessOutputSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  artifact: ArtifactRefSchema,
  mode: z.literal("cached"),
  warnings: z.array(CacheWarningSchema),
  errors: z.array(RenderErrorSchema).max(0),
});

export type MermaidToSvgCachedSuccessOutput = z.infer<
  typeof MermaidToSvgCachedSuccessOutputSchema
>;

/**
 * Success response with inline content (fallback mode).
 */
export const MermaidToSvgInlineSuccessOutputSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  svg: z.string(),
  mode: z.literal("inline"),
  warnings: z.array(CacheWarningSchema),
  errors: z.array(RenderErrorSchema).max(0),
});

export type MermaidToSvgInlineSuccessOutput = z.infer<
  typeof MermaidToSvgInlineSuccessOutputSchema
>;

/**
 * Error response (same structure for both modes).
 */
export const MermaidToSvgCachedErrorOutputSchema = z.object({
  ok: z.literal(false),
  request_id: z.string().uuid(),
  warnings: z.array(CacheWarningSchema),
  errors: z.array(RenderErrorSchema).min(1),
});

export type MermaidToSvgCachedErrorOutput = z.infer<
  typeof MermaidToSvgCachedErrorOutputSchema
>;

/**
 * Combined cached output type (success cached | success inline | error).
 */
export type MermaidToSvgCachedOutput =
  | MermaidToSvgCachedSuccessOutput
  | MermaidToSvgInlineSuccessOutput
  | MermaidToSvgCachedErrorOutput;
