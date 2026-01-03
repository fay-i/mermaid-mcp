/**
 * MCP tool: mermaid_to_deck
 * Generates a multi-page PDF deck from multiple Mermaid diagrams.
 */

import { randomUUID } from "node:crypto";
import {
  DeckRequestSchema,
  type DeckRequest,
  MAX_DIAGRAMS,
  MAX_TOTAL_SIZE,
  MAX_DIAGRAM_SIZE,
  DEFAULT_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_MARGINS,
  getPageDimensions,
} from "../schemas/mermaid-to-deck.js";
import type {
  DeckResponse,
  DeckSuccessResponse,
  DeckErrorResponse,
  DeckRenderError,
} from "../schemas/deck-response.js";
import { renderDeck, type DeckRenderOptions } from "./deck-renderer.js";
import { assembleDeck, buildPageMetadata } from "../renderer/deck-assembler.js";
import type { S3Storage } from "../storage/index.js";
import { getCdnBaseUrl, buildCdnUrl } from "./cdn-url.js";
import type { ToolConfig } from "./types.js";

/**
 * Create an error response.
 */
function createErrorResponse(
  requestId: string,
  error: DeckRenderError,
): DeckErrorResponse {
  return {
    ok: false,
    request_id: requestId,
    warnings: [],
    errors: [error],
  };
}

/**
 * Validate diagrams array: count, size, and content.
 */
function validateDiagrams(
  diagrams: DeckRequest["diagrams"],
): DeckRenderError | undefined {
  // Check count
  if (diagrams.length === 0) {
    return {
      code: "INVALID_INPUT",
      message: "At least one diagram is required",
    };
  }

  if (diagrams.length > MAX_DIAGRAMS) {
    return {
      code: "INPUT_TOO_LARGE",
      message: `Maximum ${MAX_DIAGRAMS} diagrams allowed (got ${diagrams.length})`,
    };
  }

  // Check individual and total sizes
  let totalSize = 0;
  for (let i = 0; i < diagrams.length; i++) {
    const diagram = diagrams[i];

    // Check for empty code
    if (!diagram.code || diagram.code.trim().length === 0) {
      return {
        code: "INVALID_INPUT",
        message: `Diagram at index ${i} has empty code`,
        details: { diagram_index: i },
      };
    }

    const size = Buffer.byteLength(diagram.code, "utf-8");

    // Check per-diagram limit
    if (size > MAX_DIAGRAM_SIZE) {
      return {
        code: "INPUT_TOO_LARGE",
        message: `Diagram at index ${i} exceeds 1MB limit (${size} bytes)`,
        details: { diagram_index: i },
      };
    }

    totalSize += size;
  }

  // Check total size
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      code: "INPUT_TOO_LARGE",
      message: `Total input exceeds 10MB limit (${totalSize} bytes)`,
    };
  }

  return undefined;
}

/**
 * Validate timeout_ms parameter.
 */
function validateTimeout(
  timeoutMs: number | undefined,
): DeckRenderError | undefined {
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
 * Generate correlation ID for request tracing.
 */
function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Log structured JSON message.
 */
function structuredLog(
  level: "info" | "error" | "debug",
  correlationId: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlationId,
    message,
    ...data,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * MCP tool handler: mermaid_to_deck with S3 storage.
 * Generates a multi-page PDF deck from multiple Mermaid diagrams.
 *
 * @param input - Tool input parameters
 * @param storage - S3Storage instance
 * @returns Deck response with download URL or error
 */
export async function mermaidToDeckS3(
  input: DeckRequest,
  storage: S3Storage,
): Promise<DeckResponse> {
  const requestId = randomUUID();
  const correlationId = generateCorrelationId();

  structuredLog("info", correlationId, "Deck generation started", {
    requestId,
    diagramCount: input.diagrams.length,
    pageSize: input.page_size,
    orientation: input.orientation,
  });

  // 1. Validate diagrams
  const diagramsError = validateDiagrams(input.diagrams);
  if (diagramsError) {
    structuredLog("error", correlationId, "Validation failed", {
      requestId,
      error: diagramsError,
    });
    return createErrorResponse(requestId, diagramsError);
  }

  // 2. Validate timeout
  const timeoutError = validateTimeout(input.timeout_ms);
  if (timeoutError) {
    structuredLog("error", correlationId, "Invalid timeout", {
      requestId,
      error: timeoutError,
    });
    return createErrorResponse(requestId, timeoutError);
  }

  // 3. Build render options
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const margins = input.margins ?? DEFAULT_MARGINS;
  const { width, height } = getPageDimensions(
    input.page_size,
    input.orientation,
  );

  const renderOptions: DeckRenderOptions = {
    diagrams: input.diagrams,
    pageOptions: {
      width,
      height,
      margins,
      background: input.background,
      showTitle: input.show_titles,
    },
    theme: input.theme,
    dropShadow: input.drop_shadow,
    googleFont: input.google_font,
    timeoutMs,
  };

  // 4. Render all diagrams to PDF pages
  structuredLog("info", correlationId, "Starting diagram rendering", {
    requestId,
    diagramCount: input.diagrams.length,
  });

  const renderResult = await renderDeck(renderOptions);

  if ("error" in renderResult) {
    structuredLog("error", correlationId, "Rendering failed", {
      requestId,
      error: renderResult.error,
    });
    return createErrorResponse(requestId, renderResult.error);
  }

  // 5. Assemble PDF deck
  structuredLog("info", correlationId, "Assembling PDF deck", {
    requestId,
    pageCount: renderResult.pageBuffers.length,
  });

  let deckResult: Awaited<ReturnType<typeof assembleDeck>>;
  try {
    deckResult = await assembleDeck(renderResult.pageBuffers);
  } catch (error) {
    const assemblyError: DeckRenderError = {
      code: "PDF_GENERATION_FAILED",
      message: `Failed to assemble PDF deck: ${error instanceof Error ? error.message : String(error)}`,
    };
    structuredLog("error", correlationId, "PDF assembly failed", {
      requestId,
      error: assemblyError,
    });
    return createErrorResponse(requestId, assemblyError);
  }

  // 6. Store in S3
  structuredLog("info", correlationId, "Uploading to S3", {
    requestId,
    sizeBytes: deckResult.sizeBytes,
  });

  let artifact: Awaited<ReturnType<typeof storage.storeArtifact>>;
  try {
    artifact = await storage.storeArtifact(
      deckResult.pdfBuffer,
      "application/pdf",
    );
  } catch (error) {
    const storageError: DeckRenderError = {
      code: "STORAGE_FAILED",
      message: `Failed to store artifact: ${error instanceof Error ? error.message : String(error)}`,
    };
    structuredLog("error", correlationId, "S3 upload failed", {
      requestId,
      error: storageError,
    });
    return createErrorResponse(requestId, storageError);
  }

  // 7. Build success response
  const pages = buildPageMetadata(input.diagrams);
  const outputFile = `${artifact.artifact_id}.pdf`;
  const escapedUrl = artifact.download_url.replace(/'/g, "'\\''");
  const curlCommand = `curl -o ${outputFile} '${escapedUrl}'`;

  const response: DeckSuccessResponse = {
    ok: true,
    request_id: requestId,
    artifact_id: artifact.artifact_id,
    download_url: artifact.download_url,
    curl_command: curlCommand,
    s3: artifact.s3,
    expires_in_seconds: artifact.expires_in_seconds,
    content_type: "application/pdf",
    size_bytes: deckResult.sizeBytes,
    page_count: deckResult.pageCount,
    pages,
    warnings: [],
    errors: [],
  };

  // Conditionally add CDN URL
  const cdnBaseUrl = getCdnBaseUrl();
  if (cdnBaseUrl) {
    response.cdn_url = buildCdnUrl(cdnBaseUrl, artifact.artifact_id, "pdf");
  }

  structuredLog("info", correlationId, "Deck generation completed", {
    requestId,
    artifactId: artifact.artifact_id,
    pageCount: deckResult.pageCount,
    sizeBytes: deckResult.sizeBytes,
  });

  return response;
}

/**
 * MCP tool input schema for mermaid_to_deck.
 */
export const MermaidToDeckInputSchema = DeckRequestSchema;

/**
 * MCP tool configuration for mermaid_to_deck.
 * Generates a multi-page PDF deck from multiple Mermaid diagrams.
 */
export const mermaidToDeckTool: ToolConfig<
  typeof MermaidToDeckInputSchema.shape,
  DeckResponse
> = {
  name: "mermaid_to_deck",
  description:
    "Generate a multi-page PDF deck from multiple Mermaid diagrams. Each diagram is rendered on its own page, scaled to fit. Supports flowcharts, sequence diagrams, class diagrams, and more. Returns a presigned S3 download URL.",
  inputSchema: MermaidToDeckInputSchema,
  handler: async (_input: DeckRequest): Promise<DeckResponse> => {
    // This handler requires S3 storage to be injected
    // The actual handler is mermaidToDeckS3 which takes storage as parameter
    throw new Error(
      "mermaid_to_deck requires S3 storage. Use mermaidToDeckS3 directly.",
    );
  },
};
