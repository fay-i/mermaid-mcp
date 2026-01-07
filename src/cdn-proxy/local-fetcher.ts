/**
 * Local File Fetcher for CDN Proxy
 * Feature: 010-local-disk-storage
 *
 * Fetches artifacts from local filesystem storage.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LocalStorageBackend } from "../storage/local-backend.js";

/**
 * Result of a local file fetch operation
 */
export interface LocalFileResult {
  /** File content as Buffer */
  content: Buffer;

  /** File size in bytes */
  contentLength: number;

  /** Last modified time */
  lastModified: Date;
}

/**
 * Local file fetcher interface
 */
export interface LocalFetcher {
  /**
   * Fetch artifact from local storage
   * @param sessionId - Session UUID
   * @param artifactId - Artifact UUID
   * @param extension - File extension ('svg' | 'pdf')
   * @returns File content and metadata
   * @throws Error if file not found or cannot be read
   */
  fetch(
    sessionId: string,
    artifactId: string,
    extension: "svg" | "pdf",
  ): Promise<LocalFileResult>;
}

/**
 * Create a local file fetcher using a LocalStorageBackend and base path
 */
export function createLocalFetcher(
  _backend: LocalStorageBackend,
  basePath: string,
): LocalFetcher {
  return {
    async fetch(
      sessionId: string,
      artifactId: string,
      extension: "svg" | "pdf",
    ): Promise<LocalFileResult> {
      // Construct file path
      const filePath = join(basePath, sessionId, `${artifactId}.${extension}`);

      // Read file content and stats in parallel
      const [content, stats] = await Promise.all([
        readFile(filePath),
        stat(filePath),
      ]);

      return {
        content,
        contentLength: content.length,
        lastModified: stats.mtime,
      };
    },
  };
}
