import { z } from "zod";

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
});

export type MermaidToSvgInput = z.infer<typeof MermaidToSvgInputSchema>;

/**
 * Stable error codes for render failures.
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
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

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
 * Error object for render failures.
 */
export const RenderErrorSchema = z.object({
  /** Stable error code */
  code: ErrorCodeSchema,
  /** Human-readable error description */
  message: z.string(),
  /** Additional context (e.g., line/column for parse errors) */
  details: z.record(z.unknown()).optional(),
});

export type RenderError = z.infer<typeof RenderErrorSchema>;

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
 * Output schema for the mermaid_to_svg MCP tool.
 * Discriminated union: success (ok=true) or error (ok=false).
 */
export const MermaidToSvgOutputSchema = z.discriminatedUnion("ok", [
  MermaidToSvgSuccessOutputSchema,
  MermaidToSvgErrorOutputSchema,
]);

export type MermaidToSvgOutput = z.infer<typeof MermaidToSvgOutputSchema>;
