/**
 * S3 Storage Backend Implementation
 * Feature: 010-local-disk-storage
 *
 * Wraps existing S3Storage to conform to StorageBackend interface.
 */

import {
  S3Client,
  GetObjectCommand,
  type GetObjectCommandOutput,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import type {
  S3StorageConfig,
  StorageBackend,
  StorageResult,
  StorageType,
} from "./types.js";
import { ArtifactNotFoundError, StorageError } from "./errors.js";
import { validateUUID } from "./validation.js";

/**
 * S3 storage backend implementation.
 * Provides StorageBackend interface using S3Client directly.
 */
export class S3StorageBackend implements StorageBackend {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly presignedUrlExpiry: number;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.presignedUrlExpiry = config.presignedUrlExpiry;

    // Create S3Client for all storage operations
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
    // Log with structured format for consistency
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "S3 storage backend initialized",
      bucket: this.bucket,
    };
    console.error(JSON.stringify(logEntry));
  }

  /**
   * Find artifact key by trying both .svg and .pdf extensions.
   * Returns the key if found, null if not found.
   * Throws on operational errors (non-NotFound S3 errors).
   */
  private async findArtifactKey(
    sessionId: string,
    artifactId: string,
  ): Promise<string | null> {
    const keys = [
      `${sessionId}/${artifactId}.svg`,
      `${sessionId}/${artifactId}.pdf`,
    ];

    for (const key of keys) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
        return key; // Found
      } catch (error) {
        // NotFound/NoSuchKey error means try next extension
        const errorName = (error as { name?: string }).name;
        if (errorName === "NotFound" || errorName === "NoSuchKey") {
          continue;
        }
        // Other errors are real failures - propagate them
        throw error;
      }
    }

    return null; // Not found with any extension
  }

  /**
   * Store an artifact using session-scoped S3 keys
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
      // Determine file extension from content type
      const extension = contentType === "image/svg+xml" ? "svg" : "pdf";

      // Compose session-scoped S3 key
      const key = `${sessionId}/${artifactId}.${extension}`;

      // Upload to S3 with session-scoped key
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: content,
          ContentType: contentType,
          Metadata: {
            "created-at": new Date().toISOString(),
          },
        }),
      );

      // Generate presigned URL for download
      const downloadUrl = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
        { expiresIn: this.presignedUrlExpiry },
      );

      return {
        artifact_id: artifactId,
        download_url: downloadUrl,
        content_type: contentType,
        size_bytes: content.length,
        storage_type: "s3",
        expires_in_seconds: this.presignedUrlExpiry,
        s3: {
          bucket: this.bucket,
          key,
          region: this.region,
        },
      };
    } catch (error) {
      // Map S3 errors to StorageError codes
      throw this.mapS3Error(error, "store", sessionId, artifactId);
    }
  }

  /**
   * Retrieve artifact content from S3
   */
  async retrieve(sessionId: string, artifactId: string): Promise<Buffer> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Find the artifact key
    let key: string | null;
    try {
      key = await this.findArtifactKey(sessionId, artifactId);
    } catch (error) {
      throw this.mapS3Error(error, "retrieve", sessionId, artifactId);
    }

    if (!key) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
    }

    // Retrieve the artifact content - narrow try block to only network call
    let response: GetObjectCommandOutput;
    try {
      response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      throw this.mapS3Error(error, "retrieve", sessionId, artifactId);
    }

    // Check response body outside the try/catch to avoid remapping domain errors
    if (!response.Body) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const readable = response.Body as Readable;

    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete artifact from S3
   */
  async delete(sessionId: string, artifactId: string): Promise<void> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Find the artifact key using the helper
    let key: string | null;
    try {
      key = await this.findArtifactKey(sessionId, artifactId);
    } catch (error) {
      throw this.mapS3Error(error, "delete", sessionId, artifactId);
    }

    if (!key) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
    }

    // Delete the artifact
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      throw this.mapS3Error(error, "delete", sessionId, artifactId);
    }
  }

  /**
   * Check if artifact exists in S3.
   * Returns false for NotFound errors, throws on operational errors (network, access denied, etc.).
   */
  async exists(sessionId: string, artifactId: string): Promise<boolean> {
    // Validate UUIDs (these still throw validation errors)
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Use findArtifactKey helper to check for existence
    try {
      const key = await this.findArtifactKey(sessionId, artifactId);
      return key !== null;
    } catch (error) {
      // Propagate operational errors (network, access denied, etc.)
      throw this.mapS3Error(error, "exists", sessionId, artifactId);
    }
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
  private mapS3Error(
    error: unknown,
    operation: string,
    sessionId: string,
    artifactId: string,
  ): StorageError {
    // Don't double-wrap errors that are already StorageError instances
    if (error instanceof StorageError) {
      return error;
    }

    const err = error as { name?: string; message?: string; Code?: string };

    // Map common S3 errors
    switch (err.name || err.Code) {
      case "NoSuchKey":
      case "NotFound":
        return new ArtifactNotFoundError(sessionId, artifactId);

      case "AccessDenied":
      case "Forbidden":
        return new StorageError(
          "PERMISSION_DENIED",
          `S3 access denied during ${operation}: ${err.message || "Unknown error"}`,
        );

      case "NoSuchBucket":
        return new StorageError(
          "STORAGE_UNAVAILABLE",
          `S3 bucket not found: ${this.bucket}`,
        );

      default:
        return new StorageError(
          "S3_ERROR",
          `S3 ${operation} failed: ${err.message || "Unknown error"}`,
        );
    }
  }
}
