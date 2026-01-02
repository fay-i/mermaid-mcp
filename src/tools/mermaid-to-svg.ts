/**
 * MCP tool: mermaid_to_svg
 * Renders Mermaid diagram source to SVG format.
 */

import { randomUUID } from "node:crypto";
import {
  MermaidToSvgInputSchema,
  type MermaidToSvgInput,
  type MermaidToSvgOutput,
  type MermaidToSvgCachedOutput,
  type MermaidToSvgInlineSuccessOutput,
  type RenderError,
  type CacheWarning,
} from "../schemas/mermaid-to-svg.js";
import { closeBrowser, launchBrowser, render } from "../renderer/index.js";
import type { ToolConfig } from "./types.js";
import type { CacheManager } from "../cache/index.js";

/** Maximum allowed input size in bytes (1MB) */
const MAX_INPUT_SIZE = 1_048_576;

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** Minimum allowed timeout in milliseconds */
const MIN_TIMEOUT_MS = 1000;

/** Maximum allowed timeout in milliseconds */
const MAX_TIMEOUT_MS = 120000;

/**
 * Create an error response with the given error.
 */
function createErrorResponse(
  requestId: string,
  error: RenderError,
): MermaidToSvgOutput {
  return {
    ok: false,
    request_id: requestId,
    warnings: [],
    errors: [error],
  };
}

/**
 * Validate input code presence and size.
 * Returns error if validation fails, undefined if valid.
 */
function validateInput(code: string): RenderError | undefined {
  // Check for empty or whitespace-only code
  if (!code || code.trim().length === 0) {
    return {
      code: "INVALID_INPUT",
      message: "Mermaid code cannot be empty or contain only whitespace",
    };
  }

  // Check size limit (1MB)
  const byteLength = Buffer.byteLength(code, "utf-8");
  if (byteLength > MAX_INPUT_SIZE) {
    return {
      code: "INPUT_TOO_LARGE",
      message: `Input exceeds maximum size of 1MB (${byteLength} bytes provided)`,
    };
  }

  return undefined;
}

/**
 * Validate timeout_ms parameter.
 * Returns error if validation fails, undefined if valid.
 */
function validateTimeout(
  timeoutMs: number | undefined,
): RenderError | undefined {
  if (timeoutMs === undefined) {
    return undefined;
  }

  if (timeoutMs < MIN_TIMEOUT_MS) {
    return {
      code: "INVALID_TIMEOUT",
      message: `timeout_ms must be at least ${MIN_TIMEOUT_MS}ms (got ${timeoutMs}ms)`,
    };
  }

  if (timeoutMs > MAX_TIMEOUT_MS) {
    return {
      code: "INVALID_TIMEOUT",
      message: `timeout_ms must not exceed ${MAX_TIMEOUT_MS}ms (got ${timeoutMs}ms)`,
    };
  }

  return undefined;
}

/**
 * Parse and validate config_json parameter.
 * Returns error if parsing/validation fails, parsed config if valid.
 */
function parseConfigJson(configJson: string | undefined): {
  config?: Record<string, unknown>;
  error?: RenderError;
} {
  if (configJson === undefined) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    return {
      error: {
        code: "INVALID_CONFIG",
        message: "config_json must be valid JSON",
      },
    };
  }

  // Config must be an object (not array, null, string, etc.)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      error: {
        code: "INVALID_CONFIG",
        message: "config_json must be a JSON object",
      },
    };
  }

  return { config: parsed as Record<string, unknown> };
}

/**
 * Map Mermaid/Puppeteer errors to stable error codes.
 */
function mapRenderError(error: unknown): RenderError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Check for parse errors (Mermaid syntax errors)
  if (
    errorMessage.includes("Parse error") ||
    errorMessage.includes("Syntax error") ||
    errorMessage.includes("Lexical error") ||
    errorMessage.includes("Error: UnknownDiagramError")
  ) {
    // Try to extract line information
    const lineMatch = errorMessage.match(/line (\d+)/i);
    const details: Record<string, unknown> = {};
    if (lineMatch) {
      details.line = Number.parseInt(lineMatch[1], 10);
    }

    return {
      code: "PARSE_ERROR",
      message: `Mermaid syntax error: ${errorMessage}`,
      details: Object.keys(details).length > 0 ? details : undefined,
    };
  }

  // Default to RENDER_FAILED for other errors
  return {
    code: "RENDER_FAILED",
    message: `Rendering failed: ${errorMessage}`,
  };
}

/**
 * Render Mermaid diagram to SVG with timeout enforcement.
 */
async function renderWithTimeout(
  code: string,
  timeoutMs: number,
  theme?: "default" | "dark" | "forest" | "neutral",
  background?: string,
  config?: Record<string, unknown>,
): Promise<{ svg: string } | { error: RenderError }> {
  const browser = await launchBrowser();

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("RENDER_TIMEOUT"));
      }, timeoutMs);
    });

    // Race render against timeout
    const result = await Promise.race([
      render(browser, {
        code,
        theme,
        background,
        config,
        timeoutMs,
      }),
      timeoutPromise,
    ]);

    return { svg: result.svg };
  } catch (error) {
    // Check for timeout
    if (error instanceof Error && error.message === "RENDER_TIMEOUT") {
      return {
        error: {
          code: "RENDER_TIMEOUT",
          message: `Rendering timed out after ${timeoutMs}ms`,
        },
      };
    }

    // Map other errors
    return { error: mapRenderError(error) };
  } finally {
    // Always cleanup browser
    await closeBrowser(browser);
  }
}

/**
 * MCP tool handler: mermaid_to_svg
 * Converts Mermaid diagram source to SVG format.
 */
export async function mermaidToSvg(
  input: MermaidToSvgInput,
): Promise<MermaidToSvgOutput> {
  const requestId = randomUUID();

  // 1. Validate input code
  const inputError = validateInput(input.code);
  if (inputError) {
    return createErrorResponse(requestId, inputError);
  }

  // 2. Validate timeout_ms
  const timeoutError = validateTimeout(input.timeout_ms);
  if (timeoutError) {
    return createErrorResponse(requestId, timeoutError);
  }

  // 3. Parse config_json
  const { config, error: configError } = parseConfigJson(input.config_json);
  if (configError) {
    return createErrorResponse(requestId, configError);
  }

  // 4. Render with timeout enforcement
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const renderResult = await renderWithTimeout(
    input.code,
    timeoutMs,
    input.theme,
    input.background,
    config,
  );

  if ("error" in renderResult) {
    return createErrorResponse(requestId, renderResult.error);
  }

  // 5. Return success response
  return {
    ok: true,
    request_id: requestId,
    svg: renderResult.svg,
    warnings: [],
    errors: [],
  };
}

/**
 * MCP tool configuration for mermaid_to_svg.
 * Converts Mermaid diagram source code to SVG format.
 */
export const mermaidToSvgTool: ToolConfig<
  typeof MermaidToSvgInputSchema.shape,
  MermaidToSvgOutput
> = {
  name: "mermaid_to_svg",
  description:
    "Render Mermaid diagram source code to SVG format. Supports flowcharts, sequence diagrams, class diagrams, and more.",
  inputSchema: MermaidToSvgInputSchema,
  handler: mermaidToSvg,
};

// ============================================
// Cached version (T019)
// ============================================

/**
 * Create a cached error response.
 */
function createCachedErrorResponse(
  requestId: string,
  error: RenderError,
): MermaidToSvgCachedOutput {
  return {
    ok: false,
    request_id: requestId,
    warnings: [],
    errors: [error],
  };
}

/**
 * MCP tool handler: mermaid_to_svg with caching support.
 * Converts Mermaid diagram source to SVG format, storing result in cache.
 *
 * @param input - Tool input parameters
 * @param sessionId - Session identifier for cache isolation
 * @param cacheManager - CacheManager instance
 * @returns Cached output with artifact reference
 */
export async function mermaidToSvgCached(
  input: MermaidToSvgInput,
  sessionId: string,
  cacheManager: CacheManager,
): Promise<MermaidToSvgCachedOutput> {
  const requestId = randomUUID();

  // 1. Validate input code
  const inputError = validateInput(input.code);
  if (inputError) {
    return createCachedErrorResponse(requestId, inputError);
  }

  // 2. Validate timeout_ms
  const timeoutError = validateTimeout(input.timeout_ms);
  if (timeoutError) {
    return createCachedErrorResponse(requestId, timeoutError);
  }

  // 3. Parse config_json
  const { config, error: configError } = parseConfigJson(input.config_json);
  if (configError) {
    return createCachedErrorResponse(requestId, configError);
  }

  // 4. Render with timeout enforcement
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const renderResult = await renderWithTimeout(
    input.code,
    timeoutMs,
    input.theme,
    input.background,
    config,
  );

  if ("error" in renderResult) {
    return createCachedErrorResponse(requestId, renderResult.error);
  }

  // 5. Write to cache
  const svgBuffer = Buffer.from(renderResult.svg, "utf-8");
  const artifactRef = await cacheManager.writeArtifact(
    sessionId,
    svgBuffer,
    "image/svg+xml",
  );

  // 6. Return cached success response
  return {
    ok: true,
    request_id: requestId,
    artifact: artifactRef,
    mode: "cached",
    warnings: [],
    errors: [],
  };
}

// ============================================
// With Fallback version (T055, T056, T057)
// ============================================

/**
 * MCP tool handler: mermaid_to_svg with graceful degradation.
 * Falls back to inline mode when cache is unavailable.
 *
 * @param input - Tool input parameters
 * @param sessionId - Session identifier (optional - undefined triggers fallback)
 * @param cacheManager - CacheManager instance
 * @returns Cached or inline output depending on cache availability
 */
export async function mermaidToSvgWithFallback(
  input: MermaidToSvgInput,
  sessionId: string | undefined,
  cacheManager: CacheManager,
): Promise<MermaidToSvgCachedOutput> {
  const requestId = randomUUID();

  // 1. Check if caching is available
  const canCache = sessionId !== undefined && cacheManager.isAvailable();

  // If caching is available, use cached path
  if (canCache) {
    return mermaidToSvgCached(input, sessionId, cacheManager);
  }

  // 2. Fallback to inline mode
  // Validate input first
  const inputError = validateInput(input.code);
  if (inputError) {
    return createCachedErrorResponse(requestId, inputError);
  }

  const timeoutError = validateTimeout(input.timeout_ms);
  if (timeoutError) {
    return createCachedErrorResponse(requestId, timeoutError);
  }

  const { config, error: configError } = parseConfigJson(input.config_json);
  if (configError) {
    return createCachedErrorResponse(requestId, configError);
  }

  // 3. Render with timeout enforcement
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const renderResult = await renderWithTimeout(
    input.code,
    timeoutMs,
    input.theme,
    input.background,
    config,
  );

  if ("error" in renderResult) {
    return createCachedErrorResponse(requestId, renderResult.error);
  }

  // 4. Build CACHE_UNAVAILABLE warning (T057)
  const warning: CacheWarning = {
    code: "CACHE_UNAVAILABLE",
    message:
      sessionId === undefined
        ? "No session context available - returning inline content"
        : "Cache is disabled - returning inline content",
  };

  // 5. Return inline success response
  const inlineResponse: MermaidToSvgInlineSuccessOutput = {
    ok: true,
    request_id: requestId,
    svg: renderResult.svg,
    mode: "inline",
    warnings: [warning],
    errors: [],
  };

  return inlineResponse;
}
