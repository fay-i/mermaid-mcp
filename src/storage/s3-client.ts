/**
 * S3/MinIO client for artifact storage.
 * Handles upload, presigned URL generation, and cleanup.
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { S3Config } from "./s3-config.js";

/** Content type to file extension mapping */
const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/** S3 location info */
export interface S3Location {
  bucket: string;
  key: string;
  region: string;
}

/** Artifact reference returned to clients */
export interface ArtifactResult {
  artifact_id: string;
  download_url: string;
  expires_in_seconds: number;
  content_type: string;
  size_bytes: number;
  s3: S3Location;
}

/**
 * S3Storage handles artifact persistence and URL generation.
 */
export class S3Storage {
  private client: S3Client;
  private config: S3Config;
  /** Guard to prevent concurrent cleanup operations */
  private cleanupInProgress = false;

  constructor(config: S3Config) {
    this.config = config;
    this.client = new S3Client({
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
   * Store an artifact and return a presigned download URL.
   *
   * @param artifactId - UUID for the artifact (or generated if not provided)
   * @param content - Artifact content as Buffer
   * @param contentType - MIME type (image/svg+xml or application/pdf)
   * @returns Artifact reference with presigned URL
   */
  async storeArtifact(
    artifactId: string,
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ): Promise<ArtifactResult> {
    const extension = CONTENT_TYPE_EXTENSION[contentType] ?? "bin";
    const key = `${artifactId}.${extension}`;

    // Upload to S3
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        Metadata: {
          "created-at": new Date().toISOString(),
        },
      }),
    );

    // Generate presigned URL
    const downloadUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
      { expiresIn: this.config.presignedUrlExpiresIn },
    );

    return {
      artifact_id: artifactId,
      download_url: downloadUrl,
      expires_in_seconds: this.config.presignedUrlExpiresIn,
      content_type: contentType,
      size_bytes: content.length,
      s3: {
        bucket: this.config.bucket,
        key,
        region: this.config.region,
      },
    };
  }

  /**
   * Cleanup artifacts older than the retention period.
   * Called opportunistically on writes to avoid accumulating old data.
   * Uses an in-progress guard to prevent concurrent cleanup operations.
   *
   * @returns Number of objects deleted, or -1 if cleanup was skipped (already in progress)
   */
  async cleanupOldArtifacts(): Promise<number> {
    // Guard against concurrent cleanup operations
    if (this.cleanupInProgress) {
      return -1; // Skip if already running
    }

    this.cleanupInProgress = true;
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      let deletedCount = 0;
      let continuationToken: string | undefined;

      do {
        // List objects in bucket
        const listResponse = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.config.bucket,
            ContinuationToken: continuationToken,
          }),
        );

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
          break;
        }

        // Find objects older than retention period
        const objectsToDelete: { Key: string }[] = [];
        for (const obj of listResponse.Contents) {
          if (obj.Key && obj.LastModified && obj.LastModified < cutoffDate) {
            objectsToDelete.push({ Key: obj.Key });
          }
        }

        // Delete old objects in batch
        if (objectsToDelete.length > 0) {
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.config.bucket,
              Delete: { Objects: objectsToDelete },
            }),
          );
          deletedCount += objectsToDelete.length;
        }

        continuationToken = listResponse.NextContinuationToken;
      } while (continuationToken);

      return deletedCount;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Check if the S3 storage is accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          MaxKeys: 1,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
