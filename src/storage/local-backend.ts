/**
 * Local Storage Backend Implementation
 * Feature: 010-local-disk-storage
 */

import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type {
  LocalStorageConfig,
  StorageBackend,
  StorageResult,
  StorageType,
} from "./types.js";
import {
  ArtifactNotFoundError,
  StorageFullError,
  StoragePermissionError,
} from "./errors.js";
import { validateUUID } from "./validation.js";

/**
 * Get file extension from content type
 */
function getExtension(
  contentType: "image/svg+xml" | "application/pdf",
): string {
  return contentType === "image/svg+xml" ? "svg" : "pdf";
}

/**
 * Local filesystem storage backend implementation
 */
export class LocalStorageBackend implements StorageBackend {
  private readonly config: LocalStorageConfig;

  constructor(config: LocalStorageConfig) {
    this.config = config;
  }

  /**
   * Structured logging helper for operational observability
   */
  private log(
    level: "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: "LocalStorage",
      message,
      ...context,
    };
    console.error(JSON.stringify(logEntry));
  }

  /**
   * Initialize storage backend
   * - Validates write access
   * - Cleans up orphaned .tmp files
   */
  async initialize(): Promise<void> {
    // Create base directory if needed
    await mkdir(this.config.basePath, { recursive: true });

    // Validate write access (FR-008)
    await this.validateWriteAccess();

    // Clean up orphaned .tmp files (FR-007a)
    await this.cleanupOrphanedTempFiles();
  }

  /**
   * Validate write access by creating and deleting a test file
   */
  private async validateWriteAccess(): Promise<void> {
    const testFile = join(this.config.basePath, `.write-test-${randomUUID()}`);
    try {
      await writeFile(testFile, "test", "utf-8");
      await rm(testFile);
      this.log("info", "Write access validated", {
        basePath: this.config.basePath,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        throw new StoragePermissionError(
          `Write access denied to storage path: ${this.config.basePath}`,
        );
      }
      throw new StoragePermissionError(
        `Failed to validate write access: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Clean up orphaned .tmp files from failed operations
   */
  private async cleanupOrphanedTempFiles(): Promise<void> {
    try {
      const sessions = await readdir(this.config.basePath);
      let cleanedCount = 0;

      for (const session of sessions) {
        // Skip non-directory entries and test files
        if (session.startsWith(".")) {
          continue;
        }

        const sessionPath = join(this.config.basePath, session);
        try {
          const stats = await stat(sessionPath);
          if (!stats.isDirectory()) {
            continue;
          }

          const files = await readdir(sessionPath);
          for (const file of files) {
            if (file.endsWith(".tmp")) {
              const tmpPath = join(sessionPath, file);
              await rm(tmpPath);
              cleanedCount++;
            }
          }
        } catch (error) {
          this.log("warn", "Failed to clean session", {
            sessionPath,
            error: (error as Error).message,
          });
        }
      }

      if (cleanedCount > 0) {
        this.log("info", "Cleaned up orphaned temp files", {
          cleanedCount,
        });
      }
    } catch (error) {
      // Log but don't fail startup if cleanup fails
      this.log("warn", "Failed to clean up temp files", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Ensure session directory exists
   */
  private async ensureSessionDirectory(sessionId: string): Promise<string> {
    const sessionPath = join(this.config.basePath, sessionId);
    await mkdir(sessionPath, { recursive: true });
    return sessionPath;
  }

  /**
   * Construct artifact file path
   */
  private getArtifactPath(
    sessionId: string,
    artifactId: string,
    extension: string,
  ): string {
    return join(this.config.basePath, sessionId, `${artifactId}.${extension}`);
  }

  /**
   * Construct download URL based on url scheme
   */
  private constructDownloadUrl(
    sessionId: string,
    artifactId: string,
    extension: string,
  ): string {
    if (this.config.urlScheme === "http") {
      // HTTP URL for CDN proxy
      const host = this.config.cdnHost || "localhost";
      const port = this.config.cdnPort || 3001;
      return `http://${host}:${port}/artifacts/${sessionId}/${artifactId}.${extension}`;
    }

    // file:// URL using host path
    const filePath = resolve(
      this.config.hostPath,
      sessionId,
      `${artifactId}.${extension}`,
    );
    return pathToFileURL(filePath).href;
  }

  /**
   * Store an artifact with atomic write operation
   */
  async store(
    sessionId: string,
    artifactId: string,
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ): Promise<StorageResult> {
    // Validate UUIDs (T019 - path traversal prevention)
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Ensure session directory exists (T013)
    await this.ensureSessionDirectory(sessionId);

    const extension = getExtension(contentType);
    const finalPath = this.getArtifactPath(sessionId, artifactId, extension);
    const tempPath = `${finalPath}.tmp`;

    try {
      // Write to temporary file first (T008 - atomic write)
      await writeFile(tempPath, content);

      // Atomic rename
      await rename(tempPath, finalPath);

      // Construct download URL (T014)
      const downloadUrl = this.constructDownloadUrl(
        sessionId,
        artifactId,
        extension,
      );

      return {
        artifact_id: artifactId,
        download_url: downloadUrl,
        content_type: contentType,
        size_bytes: content.length,
        storage_type: "local",
      };
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await rm(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      // Map errors to StorageError types (T016-T018)
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOSPC") {
        throw new StorageFullError("Disk full - cannot store artifact");
      }
      if (nodeError.code === "EACCES") {
        throw new StoragePermissionError(
          `Permission denied writing to ${finalPath}`,
        );
      }
      throw error;
    }
  }

  /**
   * Retrieve artifact content
   */
  async retrieve(sessionId: string, artifactId: string): Promise<Buffer> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Try both extensions since we don't know the content type
    for (const ext of ["svg", "pdf"]) {
      const filePath = this.getArtifactPath(sessionId, artifactId, ext);
      try {
        return await readFile(filePath);
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
          // Try next extension
          continue;
        }
        // Other errors (permission, etc.)
        if (nodeError.code === "EACCES") {
          throw new StoragePermissionError(
            `Permission denied reading ${filePath}`,
          );
        }
        throw error;
      }
    }

    // Neither extension found
    throw new ArtifactNotFoundError(sessionId, artifactId);
  }

  /**
   * Delete an artifact
   */
  async delete(sessionId: string, artifactId: string): Promise<void> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Try both extensions
    let deleted = false;
    for (const ext of ["svg", "pdf"]) {
      const filePath = this.getArtifactPath(sessionId, artifactId, ext);
      try {
        await rm(filePath);
        deleted = true;
        break;
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
          // Try next extension
          continue;
        }
        throw error;
      }
    }

    if (!deleted) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
    }
  }

  /**
   * Check if artifact exists
   */
  async exists(sessionId: string, artifactId: string): Promise<boolean> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Check both extensions
    for (const ext of ["svg", "pdf"]) {
      const filePath = this.getArtifactPath(sessionId, artifactId, ext);
      try {
        await stat(filePath);
        return true;
      } catch {}
    }

    return false;
  }

  /**
   * Health check for local storage
   * Verifies write access and storage availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if base path is accessible
      await stat(this.config.basePath);

      // Try a quick write/delete operation to verify write access
      const testFile = join(
        this.config.basePath,
        `.health-check-${randomUUID()}`,
      );
      await writeFile(testFile, "", "utf-8");
      await rm(testFile);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage backend type
   */
  getType(): StorageType {
    return "local";
  }
}
