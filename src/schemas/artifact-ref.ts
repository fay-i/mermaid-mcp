/**
 * Artifact reference schema for MCP tool responses.
 * Per contracts/artifact-reference.json specification.
 */

import { z } from "zod";

/**
 * Artifact reference schema - lightweight reference returned by render tools.
 * Used when caching is enabled to avoid inline base64 content.
 */
export const ArtifactRefSchema = z.object({
  /** Unique identifier for retrieving the artifact via fetch_artifact */
  artifact_id: z.string().uuid(),
  /** File URI pointing to the cached artifact */
  uri: z.string().startsWith("file://"),
  /** MIME type of the artifact */
  content_type: z.enum(["image/svg+xml", "application/pdf"]),
  /** Size of the artifact in bytes */
  size_bytes: z.number().int().positive(),
});

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
