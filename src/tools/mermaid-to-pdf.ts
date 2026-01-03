/**
 * MCP tool: mermaid_to_pdf
 * Renders Mermaid diagram source to PDF format using Puppeteer's native page.pdf().
 */

import { randomUUID } from "node:crypto";
import {
  MermaidToPdfInputSchema,
  type MermaidToPdfInput,
  type MermaidToPdfOutput,
  type MermaidToPdfCachedOutput,
  type MermaidToPdfInlineSuccessOutput,
  type PdfRenderError,
} from "../schemas/mermaid-to-pdf.js";
import type { CacheWarning } from "../schemas/mermaid-to-svg.js";
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

/** SVG rendering gets 80% of the timeout budget */
const SVG_TIMEOUT_RATIO = 0.8;

/** PDF generation gets 20% of the timeout budget */
const PDF_TIMEOUT_RATIO = 0.2;

/**
 * Split timeout budget between SVG rendering and PDF generation.
 * SVG rendering is typically slower, so it gets 80% of the budget.
 */
export function splitTimeoutBudget(totalMs: number): {
  svgTimeoutMs: number;
  pdfTimeoutMs: number;
} {
  return {
    svgTimeoutMs: Math.floor(totalMs * SVG_TIMEOUT_RATIO),
    pdfTimeoutMs: Math.floor(totalMs * PDF_TIMEOUT_RATIO),
  };
}

/**
 * Create an error response with the given error.
 */
function createErrorResponse(
  requestId: string,
  error: PdfRenderError,
): MermaidToPdfOutput {
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
function validateInput(code: string): PdfRenderError | undefined {
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
): PdfRenderError | undefined {
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
  error?: PdfRenderError;
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
function mapRenderError(error: unknown): PdfRenderError {
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
 * Extract dimensions from SVG markup for PDF page sizing.
 */
function extractSvgDimensions(svg: string): { width: number; height: number } {
  // Try to extract from width/height attributes
  const widthMatch = svg.match(/width="([^"]+)"/);
  const heightMatch = svg.match(/height="([^"]+)"/);

  let width = 0;
  let height = 0;

  if (widthMatch) {
    width = Number.parseFloat(widthMatch[1]) || 0;
  }

  if (heightMatch) {
    height = Number.parseFloat(heightMatch[1]) || 0;
  }

  // If no width/height, try viewBox
  if (width === 0 || height === 0) {
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/);
      if (parts.length >= 4) {
        width = Number.parseFloat(parts[2]) || 0;
        height = Number.parseFloat(parts[3]) || 0;
      }
    }
  }

  // Default to reasonable page size if dimensions cannot be extracted
  if (width === 0) width = 800;
  if (height === 0) height = 600;

  return { width, height };
}

/**
 * Create minimal HTML document with embedded SVG for PDF conversion.
 */
function createHtmlWithSvg(svg: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; justify-content: center; align-items: center; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${svg}
</body>
</html>`;
}

/**
 * Render Mermaid diagram to PDF with timeout enforcement.
 */
async function renderWithTimeout(
  code: string,
  timeoutMs: number,
  theme?: "default" | "dark" | "forest" | "neutral",
  background?: string,
  config?: Record<string, unknown>,
): Promise<{ pdf: string } | { error: PdfRenderError }> {
  const { svgTimeoutMs, pdfTimeoutMs } = splitTimeoutBudget(timeoutMs);
  const browser = await launchBrowser();

  try {
    // Phase 1: Render Mermaid to SVG (80% of timeout budget)
    const svgTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("RENDER_TIMEOUT"));
      }, svgTimeoutMs);
    });

    let svgResult: { svg: string; width: number; height: number };
    try {
      svgResult = await Promise.race([
        render(browser, {
          code,
          theme,
          background,
          config,
          timeoutMs: svgTimeoutMs,
        }),
        svgTimeoutPromise,
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "RENDER_TIMEOUT") {
        return {
          error: {
            code: "RENDER_TIMEOUT",
            message: `SVG rendering timed out after ${svgTimeoutMs}ms`,
          },
        };
      }
      return { error: mapRenderError(error) };
    }

    // Phase 2: Convert SVG to PDF (20% of timeout budget)
    const { width, height } = extractSvgDimensions(svgResult.svg);
    const html = createHtmlWithSvg(svgResult.svg);

    const pdfTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("PDF_TIMEOUT"));
      }, pdfTimeoutMs);
    });

    let pdfBuffer: Uint8Array;
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });

      pdfBuffer = await Promise.race([
        page.pdf({
          printBackground: true,
          width: width,
          height: height,
          pageRanges: "1",
          scale: 1,
        }),
        pdfTimeoutPromise,
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "PDF_TIMEOUT") {
        return {
          error: {
            code: "RENDER_TIMEOUT",
            message: `PDF generation timed out after ${pdfTimeoutMs}ms`,
          },
        };
      }
      // PDF-specific failure after successful SVG render
      return {
        error: {
          code: "PDF_GENERATION_FAILED",
          message: `Failed to convert SVG to PDF: ${error instanceof Error ? error.message : String(error)}`,
          details: { phase: "pdf_conversion" },
        },
      };
    } finally {
      await page.close();
    }

    // Encode PDF as base64
    const base64Pdf = Buffer.from(pdfBuffer).toString("base64");

    return { pdf: base64Pdf };
  } finally {
    // Always cleanup browser
    await closeBrowser(browser);
  }
}

/**
 * MCP tool handler: mermaid_to_pdf
 * Converts Mermaid diagram source to PDF format.
 */
export async function mermaidToPdf(
  input: MermaidToPdfInput,
): Promise<MermaidToPdfOutput> {
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
    pdf: renderResult.pdf,
    warnings: [],
    errors: [],
  };
}

/**
 * MCP tool configuration for mermaid_to_pdf.
 * Converts Mermaid diagram source code to PDF format.
 */
export const mermaidToPdfTool: ToolConfig<
  typeof MermaidToPdfInputSchema.shape,
  MermaidToPdfOutput
> = {
  name: "mermaid_to_pdf",
  description:
    "Render Mermaid diagram source code to PDF format. Supports flowcharts, sequence diagrams, class diagrams, and more. Output is base64-encoded PDF with vector graphics preserved.",
  inputSchema: MermaidToPdfInputSchema,
  handler: mermaidToPdf,
};

// ============================================
// Cached version (T021)
// ============================================

/**
 * Create a cached error response.
 */
function createCachedErrorResponse(
  requestId: string,
  error: PdfRenderError,
): MermaidToPdfCachedOutput {
  return {
    ok: false,
    request_id: requestId,
    warnings: [],
    errors: [error],
  };
}

/**
 * MCP tool handler: mermaid_to_pdf with caching support.
 * Converts Mermaid diagram source to PDF format, storing result in cache.
 *
 * @param input - Tool input parameters
 * @param sessionId - Session identifier for cache isolation
 * @param cacheManager - CacheManager instance
 * @returns Cached output with artifact reference
 */
export async function mermaidToPdfCached(
  input: MermaidToPdfInput,
  sessionId: string,
  cacheManager: CacheManager,
): Promise<MermaidToPdfCachedOutput> {
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

  // 5. Write to cache (PDF is already base64, decode to binary)
  const pdfBuffer = Buffer.from(renderResult.pdf, "base64");
  const artifactRef = await cacheManager.writeArtifact(
    sessionId,
    pdfBuffer,
    "application/pdf",
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
// With Fallback version (T056)
// ============================================

/**
 * MCP tool handler: mermaid_to_pdf with graceful degradation.
 * Falls back to inline mode when cache is unavailable.
 *
 * @param input - Tool input parameters
 * @param sessionId - Session identifier (optional - undefined triggers fallback)
 * @param cacheManager - CacheManager instance
 * @returns Cached or inline output depending on cache availability
 */
export async function mermaidToPdfWithFallback(
  input: MermaidToPdfInput,
  sessionId: string | undefined,
  cacheManager: CacheManager,
): Promise<MermaidToPdfCachedOutput> {
  const requestId = randomUUID();

  // 1. Check if caching is available
  const canCache = sessionId !== undefined && cacheManager.isAvailable();

  // If caching is available, use cached path
  if (canCache) {
    return mermaidToPdfCached(input, sessionId, cacheManager);
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

  // 4. Build CACHE_UNAVAILABLE warning
  const warning: CacheWarning = {
    code: "CACHE_UNAVAILABLE",
    message:
      sessionId === undefined
        ? "No session context available - returning inline content"
        : "Cache is disabled - returning inline content",
  };

  // 5. Return inline success response
  const inlineResponse: MermaidToPdfInlineSuccessOutput = {
    ok: true,
    request_id: requestId,
    pdf_base64: renderResult.pdf,
    mode: "inline",
    warnings: [warning],
    errors: [],
  };

  return inlineResponse;
}

// ============================================
// S3 Storage version
// ============================================

import type { S3Storage } from "../storage/index.js";
import type {
  ArtifactOutput,
  ArtifactSuccessOutput,
  RenderError as ArtifactRenderError,
} from "../schemas/artifact-output.js";
import { getCdnBaseUrl, buildCdnUrl } from "./cdn-url.js";

/**
 * Map internal PdfRenderError to ArtifactRenderError.
 * Both types now use the shared ErrorCodeSchema, so they're structurally identical.
 */
function mapToArtifactError(error: PdfRenderError): ArtifactRenderError {
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
 * MCP tool handler: mermaid_to_pdf with S3 storage.
 * Converts Mermaid diagram source to PDF format, stores in S3,
 * and returns a presigned download URL.
 *
 * @param input - Tool input parameters
 * @param storage - S3Storage instance
 * @returns Output with presigned download URL
 */
export async function mermaidToPdfS3(
  input: MermaidToPdfInput,
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
  );

  if ("error" in renderResult) {
    return createS3ErrorResponse(
      requestId,
      mapToArtifactError(renderResult.error),
    );
  }

  // 5. Store in S3 and get presigned URL
  try {
    const pdfBuffer = Buffer.from(renderResult.pdf, "base64");
    const artifact = await storage.storeArtifact(pdfBuffer, "application/pdf");

    // Generate curl command with output filename
    // Escape single quotes in URL for shell safety (replace ' with '\'' for proper shell escaping)
    const outputFile = `${artifact.artifact_id}.pdf`;
    const escapedUrl = artifact.download_url.replace(/'/g, "'\\''");
    const curlCommand = `curl -o ${outputFile} '${escapedUrl}'`;

    // Build response object
    const response: ArtifactSuccessOutput = {
      ok: true,
      request_id: requestId,
      artifact_id: artifact.artifact_id,
      download_url: artifact.download_url,
      curl_command: curlCommand,
      s3: artifact.s3,
      expires_in_seconds: artifact.expires_in_seconds,
      content_type: "application/pdf",
      size_bytes: artifact.size_bytes,
      warnings: [],
      errors: [],
    };

    // Conditionally add cdn_url when configured
    const cdnBaseUrl = getCdnBaseUrl();
    if (cdnBaseUrl) {
      response.cdn_url = buildCdnUrl(cdnBaseUrl, artifact.artifact_id, "pdf");
    }

    return response;
  } catch (error) {
    return createS3ErrorResponse(requestId, {
      code: "STORAGE_FAILED",
      message: `Failed to store artifact: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
