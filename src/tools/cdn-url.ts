/**
 * CDN URL builder for artifact responses.
 * Provides cdn_url field when MERMAID_CDN_BASE_URL is configured.
 */

/**
 * Get the CDN base URL from environment configuration.
 * Returns undefined if not configured.
 */
export function getCdnBaseUrl(): string | undefined {
  const baseUrl = process.env.MERMAID_CDN_BASE_URL;

  // Return undefined for empty or whitespace-only values
  if (!baseUrl || baseUrl.trim().length === 0) {
    return undefined;
  }

  // Remove trailing slash for consistent URL building
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Build a CDN URL for an artifact.
 *
 * @param baseUrl - CDN base URL (e.g., "https://cdn.example.com")
 * @param artifactId - Artifact UUID
 * @param extension - File extension ("svg" or "pdf")
 * @returns Full CDN URL (e.g., "https://cdn.example.com/artifacts/{id}.svg")
 */
export function buildCdnUrl(
  baseUrl: string,
  artifactId: string,
  extension: "svg" | "pdf",
): string {
  // Remove trailing slash from base URL
  const cleanBase = baseUrl.replace(/\/+$/, "");

  return `${cleanBase}/artifacts/${artifactId}.${extension}`;
}
