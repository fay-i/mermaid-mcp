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
import { ArtifactNotFoundError, StorageError } from "./errors.js";
import { validateUUID } from "./validation.js";

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
    // Log with structured format for consistency
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "S3 storage backend initialized",
      bucket: this.config.bucket,
    };
    console.error(JSON.stringify(logEntry));
  }

  /**
   * Find artifact key by trying both .svg and .pdf extensions.
   * Returns the key if found, null if not found.
   * Throws on operational errors (non-NotFound S3 errors).
   */
  private async findArtifactKey(artifactId: string): Promise<string | null> {
    const keys = [`${artifactId}.svg`, `${artifactId}.pdf`];

    for (const key of keys) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.config.bucket,
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
      // Use existing S3Storage implementation - pass artifactId
      const result = await this.s3Storage.storeArtifact(
        artifactId,
        content,
        contentType,
      );

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
      key = await this.findArtifactKey(artifactId);
    } catch (error) {
      throw this.mapS3Error(error, "retrieve", sessionId, artifactId);
    }

    if (!key) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
    }

    // Retrieve the artifact content
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );

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
    } catch (error) {
      throw this.mapS3Error(error, "retrieve", sessionId, artifactId);
    }
  }

  /**
   * Delete artifact from S3
   */
  async delete(sessionId: string, artifactId: string): Promise<void> {
    // Validate UUIDs
    validateUUID(sessionId, "sessionId");
    validateUUID(artifactId, "artifactId");

    // Try to find and delete artifact with both possible extensions
    const keys = [`${artifactId}.svg`, `${artifactId}.pdf`];

    let found = false;
    for (const key of keys) {
      try {
        // First verify existence with HeadObjectCommand
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );

        // Object exists, now delete it
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );

        found = true;
        break; // Only one extension should exist
      } catch (error) {
        // NotFound/NoSuchKey error means try next extension
        const errorName = (error as { name?: string }).name;
        if (errorName === "NotFound" || errorName === "NoSuchKey") {
          continue;
        }
        // Other errors are real failures - propagate them
        throw this.mapS3Error(error, "delete", sessionId, artifactId);
      }
    }

    if (!found) {
      throw new ArtifactNotFoundError(sessionId, artifactId);
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

    // Check both extensions
    const keys = [`${artifactId}.svg`, `${artifactId}.pdf`];

    for (const key of keys) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
          }),
        );
        return true; // Found
      } catch (error) {
        // NotFound/NoSuchKey error means try next extension
        const errorName = (error as { name?: string }).name;
        if (errorName === "NotFound" || errorName === "NoSuchKey") {
          continue;
        }
        // Other errors are operational failures - propagate them
        throw this.mapS3Error(error, "exists", sessionId, artifactId);
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
  private mapS3Error(
    error: unknown,
    operation: string,
    sessionId: string,
    artifactId: string,
  ): StorageError {
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
