/**
 * MCP tool: fetch_artifact
 * Retrieves a previously rendered artifact by its ID.
 * T030, T031: Implement getArtifact method usage and tool handler.
 */

import {
  FetchArtifactInputSchema,
  type FetchArtifactInput,
  type FetchArtifactOutput,
  type FetchArtifactError,
} from "../schemas/fetch-artifact.js";
import type { CacheManager } from "../cache/index.js";
import type { ToolConfig } from "./types.js";

/**
 * Create an error response.
 */
function createErrorResponse(error: FetchArtifactError): FetchArtifactOutput {
  return {
    ok: false,
    errors: [error],
  };
}

/**
 * MCP tool handler: fetch_artifact
 * Retrieves a previously rendered artifact by its ID.
 *
 * @param input - Tool input parameters
 * @param sessionId - Session identifier for isolation check
 * @param cacheManager - CacheManager instance
 * @returns Artifact content or error
 */
export async function fetchArtifact(
  input: FetchArtifactInput,
  sessionId: string,
  cacheManager: CacheManager,
): Promise<FetchArtifactOutput> {
  const encoding = input.encoding ?? "base64";

  // Get artifact from cache (includes UUID validation and session check)
  const result = await cacheManager.getArtifact(input.artifact_id, sessionId);

  if (!result.ok) {
    // Map CacheError to FetchArtifactError
    // getArtifact only returns: INVALID_ARTIFACT_ID, ARTIFACT_NOT_FOUND, SESSION_MISMATCH
    const fetchError: FetchArtifactError = {
      code: result.error.code as FetchArtifactError["code"],
      message: result.error.message,
      details: result.error.details,
    };
    return createErrorResponse(fetchError);
  }

  // Encode content based on requested encoding
  const content =
    encoding === "base64"
      ? result.value.content.toString("base64")
      : result.value.content.toString("utf-8");

  return {
    ok: true,
    content,
    content_type: result.value.contentType as
      | "image/svg+xml"
      | "application/pdf",
    size_bytes: result.value.sizeBytes,
    encoding,
  };
}

/**
 * MCP tool configuration for fetch_artifact.
 * Retrieves a previously rendered artifact by its ID.
 */
export const fetchArtifactTool: ToolConfig<
  typeof FetchArtifactInputSchema.shape,
  FetchArtifactOutput
> = {
  name: "fetch_artifact",
  description:
    "Retrieve a previously rendered artifact by its ID. Returns the full content of the artifact with optional encoding.",
  inputSchema: FetchArtifactInputSchema,
  handler: async (_params) => {
    // Note: This is a placeholder - actual implementation requires sessionId and cacheManager
    // which will be provided by the MCP server integration
    throw new Error(
      "fetch_artifact requires session context - use fetchArtifact function directly",
    );
  },
};
