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
  dropShadow?: boolean,
  googleFont?: string,
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
        dropShadow,
        googleFont,
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
    input.drop_shadow,
    input.google_font,
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
    input.drop_shadow,
    input.google_font,
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
    input.drop_shadow,
    input.google_font,
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

// ============================================
// S3 Storage version
// ============================================

import type { S3Storage, StorageBackend } from "../storage/index.js";
import type {
  ArtifactOutput,
  ArtifactSuccessOutput,
  RenderError as ArtifactRenderError,
} from "../schemas/artifact-output.js";
import { getCdnBaseUrl, buildCdnUrl } from "./cdn-url.js";

/**
 * Map internal RenderError to ArtifactRenderError.
 * Both types now use the shared ErrorCodeSchema, so they're structurally identical.
 */
function mapToArtifactError(error: RenderError): ArtifactRenderError {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

/**
 * Create an S3 error response.
 */
function createS3ErrorResponse(
  requestId: string,
  error: ArtifactRenderError,
): ArtifactOutput {
  return {
    ok: false,
    request_id: requestId,
    warnings: [],
    errors: [error],
  };
}

/**
 * MCP tool handler: mermaid_to_svg with S3 storage.
 * Converts Mermaid diagram source to SVG format, stores in S3,
 * and returns a presigned download URL.
 *
 * @param input - Tool input parameters
 * @param storage - S3Storage instance
 * @returns Output with presigned download URL
 */
export async function mermaidToSvgS3(
  input: MermaidToSvgInput,
  storage: S3Storage,
): Promise<ArtifactOutput> {
  const requestId = randomUUID();

  // 1. Validate input code
  const inputError = validateInput(input.code);
  if (inputError) {
    return createS3ErrorResponse(requestId, mapToArtifactError(inputError));
  }

  // 2. Validate timeout_ms
  const timeoutError = validateTimeout(input.timeout_ms);
  if (timeoutError) {
    return createS3ErrorResponse(requestId, mapToArtifactError(timeoutError));
  }

  // 3. Parse config_json
  const { config, error: configError } = parseConfigJson(input.config_json);
  if (configError) {
    return createS3ErrorResponse(requestId, mapToArtifactError(configError));
  }

  // 4. Render with timeout enforcement
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const renderResult = await renderWithTimeout(
    input.code,
    timeoutMs,
    input.theme,
    input.background,
    config,
    input.drop_shadow,
    input.google_font,
  );

  if ("error" in renderResult) {
    return createS3ErrorResponse(
      requestId,
      mapToArtifactError(renderResult.error),
    );
  }

  // 5. Store in S3 and get presigned URL
  try {
    const svgBuffer = Buffer.from(renderResult.svg, "utf-8");
    const artifactId = randomUUID();
    const artifact = await storage.storeArtifact(
      artifactId,
      svgBuffer,
      "image/svg+xml",
    );

    // Generate curl command with output filename
    // Escape single quotes in URL for shell safety (replace ' with '\'' for proper shell escaping)
    const outputFile = `${artifact.artifact_id}.svg`;
    const escapedUrl = artifact.download_url.replace(/'/g, "'\\''");
    const curlCommand = `curl -o ${outputFile} '${escapedUrl}'`;

    // Build response object
    const response: ArtifactSuccessOutput = {
      ok: true,
      request_id: requestId,
      artifact_id: artifact.artifact_id,
      download_url: artifact.download_url,
      curl_command: curlCommand,
      storage_type: "s3",
      s3: artifact.s3,
      expires_in_seconds: artifact.expires_in_seconds,
      content_type: "image/svg+xml",
      size_bytes: artifact.size_bytes,
      warnings: [],
      errors: [],
    };

    // Conditionally add cdn_url when configured
    const cdnBaseUrl = getCdnBaseUrl();
    if (cdnBaseUrl) {
      response.cdn_url = buildCdnUrl(cdnBaseUrl, artifact.artifact_id, "svg");
    }

    return response;
  } catch (error) {
    return createS3ErrorResponse(requestId, {
      code: "STORAGE_FAILED",
      message: `Failed to store artifact: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * MCP tool handler: mermaid_to_svg with StorageBackend.
 * Converts Mermaid diagram source to SVG format, stores using StorageBackend,
 * and returns a download URL (file:// for local, https:// for S3).
 *
 * @param input - Tool input parameters
 * @param storage - StorageBackend instance (local or S3)
 * @param sessionId - Session identifier for artifact grouping (optional, generates default if not provided)
 * @returns Output with download URL
 */
export async function mermaidToSvgWithStorage(
  input: MermaidToSvgInput,
  storage: StorageBackend,
  sessionId?: string,
): Promise<ArtifactOutput> {
  const requestId = randomUUID();
  const artifactSessionId = sessionId ?? randomUUID(); // Generate default session if not provided

  // 1. Validate input code
  const inputError = validateInput(input.code);
  if (inputError) {
    return createS3ErrorResponse(requestId, mapToArtifactError(inputError));
  }

  // 2. Validate timeout_ms
  const timeoutError = validateTimeout(input.timeout_ms);
  if (timeoutError) {
    return createS3ErrorResponse(requestId, mapToArtifactError(timeoutError));
  }

  // 3. Parse config_json
  const { config, error: configError } = parseConfigJson(input.config_json);
  if (configError) {
    return createS3ErrorResponse(requestId, mapToArtifactError(configError));
  }

  // 4. Render with timeout enforcement
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const renderResult = await renderWithTimeout(
    input.code,
    timeoutMs,
    input.theme,
    input.background,
    config,
    input.drop_shadow,
    input.google_font,
  );

  if ("error" in renderResult) {
    return createS3ErrorResponse(
      requestId,
      mapToArtifactError(renderResult.error),
    );
  }

  // 5. Store using StorageBackend
  try {
    const svgBuffer = Buffer.from(renderResult.svg, "utf-8");
    const artifactId = randomUUID();
    const storageResult = await storage.store(
      artifactSessionId,
      artifactId,
      svgBuffer,
      "image/svg+xml",
    );

    // Generate curl command with output filename
    const outputFile = `${storageResult.artifact_id}.svg`;
    const escapedUrl = storageResult.download_url.replace(/'/g, "'\\''");
    const curlCommand = `curl -o ${outputFile} '${escapedUrl}'`;

    // Build response object
    const response: ArtifactSuccessOutput = {
      ok: true,
      request_id: requestId,
      artifact_id: storageResult.artifact_id,
      download_url: storageResult.download_url,
      curl_command: curlCommand,
      storage_type: storageResult.storage_type,
      content_type: storageResult.content_type,
      size_bytes: storageResult.size_bytes,
      warnings: [],
      errors: [],
    };

    // Add S3-specific fields if S3 storage
    if (storageResult.storage_type === "s3") {
      if (storageResult.s3) {
        response.s3 = storageResult.s3;
      }
      if (storageResult.expires_in_seconds !== undefined) {
        response.expires_in_seconds = storageResult.expires_in_seconds;
      }
    }

    // Conditionally add cdn_url when configured
    const cdnBaseUrl = getCdnBaseUrl();
    if (cdnBaseUrl) {
      response.cdn_url = buildCdnUrl(
        cdnBaseUrl,
        storageResult.artifact_id,
        "svg",
      );
    }

    return response;
  } catch (error) {
    return createS3ErrorResponse(requestId, {
      code: "STORAGE_FAILED",
      message: `Failed to store artifact: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
