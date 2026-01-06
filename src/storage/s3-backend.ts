/**
 * S3 Storage Backend Implementation
 * Feature: 010-local-disk-storage
 * 
 * Wraps existing S3Storage to conform to StorageBackend interface.
 */

import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type {
  S3StorageConfig,
  StorageBackend,
  StorageResult,
  StorageType,
} from "./types.js";
import { S3Storage } from "./s3-client.js";
import {
  ArtifactNotFoundError,
  InvalidArtifactIdError,
  InvalidSessionIdError,
  StorageError,
} from "./errors.js";

/**
 * UUID validation regex (RFC 4122)
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates UUID format to prevent path traversal attacks
 */
function validateUUID(id: string, fieldName: string): void {
  if (!UUID_REGEX.test(id)) {
    if (fieldName === "sessionId") {
      throw new InvalidSessionIdError(id);
    }
    throw new InvalidArtifactIdError(id);
  }
}

/**
 * Get file extension from content type
 */
function getExtension(
  contentType: "image/svg+xml" | "application/pdf",
): string {
  return contentType === "image/svg+xml" ? "svg" : "pdf";
}

/**
 * S3 storage backend implementation.
 * Wraps existing S3Storage and provides StorageBackend interface.
 */
export class S3StorageBackend implements StorageBackend {
  private readonly s3Storage: S3Storage;
  private readonly s3Client: S3Client;
  private readonly config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = config;
    
    // Create S3Storage instance for upload operations
    this.s3Storage = new S3Storage({
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      presignedUrlExpiresIn: config.presignedUrlExpiry,
      retentionDays: 7, // Default retention for cleanup
    });

    // Create S3Client for retrieve/delete/exists operations
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Initialize storage backend (no-op for S3)
   */
  async initialize(): Promise<void> {
    // S3 doesn't require initialization
    console.log(`[S3Storage] Backend initialized: ${this.config.bucket}`);
  }

  /**
   * Store an artifact using existing S3Storage.storeArtifact()
   */
  async store(
    sessionId: string,
    artifactId: string,
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ): Promise<StorageResult> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    try {
      // Use existing S3Storage implementation
      const result = await this.s3Storage.storeArtifact(content, contentType);

      // Convert ArtifactResult to StorageResult
      return {
        artifact_id: result.artifact_id,
        download_url: result.download_url,
        content_type: contentType,
        size_bytes: result.size_bytes,
        storage_type: "s3",
        expires_in_seconds: result.expires_in_seconds,
        s3: result.s3,
      };
    } catch (error) {
      // Map S3 errors to StorageError codes
      throw this.mapS3Error(error, "store");
    }
  }

  /**
   * Retrieve artifact content from S3
   */
  async retrieve(sessionId: string, artifactId: string): Promise<Buffer> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // S3 keys don't use sessionId (backward compatibility)
    // Format: {artifact_id}.{ext}
    // We need to check both .svg and .pdf extensions
    const keys = [
      `${artifactId}.svg`,
      `${artifactId}.pdf`,
    ];

    for (const key of keys) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );

        if (!response.Body) {
          continue; // Try next extension
        }

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        const readable = response.Body as Readable;

        for await (const chunk of readable) {
          chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
      } catch (error) {
        // NoSuchKey error means try next extension
        if ((error as { name?: string }).name === "NoSuchKey") {
          continue;
        }
        // Other errors are real failures
        throw this.mapS3Error(error, "retrieve");
      }
    }

    // Artifact not found with any extension
    throw new ArtifactNotFoundError(sessionId, artifactId);
  }

  /**
   * Delete artifact from S3
   */
  async delete(sessionId: string, artifactId: string): Promise<void> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Check both extensions
    const keys = [
      `${artifactId}.svg`,
      `${artifactId}.pdf`,
    ];

    let found = false;
    for (const key of keys) {
      try {
        // Check if exists first
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );

        // Delete if exists
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );

        found = true;
        break; // Only one extension should exist
      } catch (error) {
        // NotFound error means try next extension
        if ((error as { name?: string }).name === "NotFound") {
          continue;
        }
        throw this.mapS3Error(error, "delete");
      }
    }

    if (!found) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
    }
  }

  /**
   * Check if artifact exists in S3
   */
  async exists(sessionId: string, artifactId: string): Promise<boolean> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Check both extensions
    const keys = [
      `${artifactId}.svg`,
      `${artifactId}.pdf`,
    ];

    for (const key of keys) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );
        return true; // Found with this extension
      } catch (error) {
        // NotFound error means try next extension
        if ((error as { name?: string }).name === "NotFound") {
          continue;
        }
        // Other errors are real failures
        throw this.mapS3Error(error, "exists");
      }
    }

    return false; // Not found with any extension
  }

  /**
   * Get storage backend type
   */
  getType(): StorageType {
    return "s3";
  }

  /**
   * Map S3 errors to StorageError codes
   */
  private mapS3Error(error: unknown, operation: string): StorageError {
    const err = error as { name?: string; message?: string; Code?: string };

    // Map common S3 errors
    switch (err.name || err.Code) {
      case "NoSuchKey":
      case "NotFound":
        return new ArtifactNotFoundError("unknown", "unknown");

      case "AccessDenied":
      case "Forbidden":
        return new StorageError(
          "PERMISSION_DENIED",
          `S3 access denied during ${operation}: ${err.message || "Unknown error"}`,
        );

      case "NoSuchBucket":
        return new StorageError(
          "STORAGE_UNAVAILABLE",
          `S3 bucket not found: ${this.config.bucket}`,
        );

      default:
        return new StorageError(
          "S3_ERROR",
          `S3 ${operation} failed: ${err.message || "Unknown error"}`,
        );
    }
  }
}
