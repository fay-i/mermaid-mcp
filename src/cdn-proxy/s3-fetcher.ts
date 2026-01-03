/**
 * S3 artifact fetcher for CDN Proxy.
 * Handles GetObject operations and streaming.
 */

import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

/**
 * S3 fetcher configuration.
 */
export interface S3FetcherConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/**
 * Result of fetching an artifact from S3.
 */
export interface FetchResult {
  content: Buffer;
  contentType: string;
  contentLength: number;
  etag?: string;
  lastModified?: Date;
}

/**
 * S3 fetch error types.
 */
export type S3FetchError = "NOT_FOUND" | "S3_ERROR";

/**
 * S3 fetcher interface.
 */
export interface S3Fetcher {
  fetch(key: string): Promise<FetchResult>;
  healthCheck(): Promise<boolean>;
}

/**
 * Create an S3 fetcher for artifact retrieval.
 */
export function createS3Fetcher(config: S3FetcherConfig): S3Fetcher {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // Required for MinIO
  });

  return {
    async fetch(key: string): Promise<FetchResult> {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new S3NotFoundError(key);
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      const readable = response.Body as Readable;

      for await (const chunk of readable) {
        chunks.push(Buffer.from(chunk));
      }

      const content = Buffer.concat(chunks);

      return {
        content,
        contentType: response.ContentType ?? "application/octet-stream",
        contentLength: response.ContentLength ?? content.length,
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    },

    async healthCheck(): Promise<boolean> {
      try {
        await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            MaxKeys: 1,
          }),
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Error thrown when artifact is not found in S3.
 */
export class S3NotFoundError extends Error {
  constructor(key: string) {
    super(`Artifact not found: ${key}`);
    this.name = "S3NotFoundError";
  }
}

/**
 * Check if an error is an S3 not found error.
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof S3NotFoundError) {
    return true;
  }
  // AWS SDK throws errors with name "NoSuchKey"
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "NoSuchKey"
  ) {
    return true;
  }
  return false;
}
