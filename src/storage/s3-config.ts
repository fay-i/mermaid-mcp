/**
 * S3/MinIO configuration loader.
 * Reads settings from environment variables.
 */

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Presigned URL expiration in seconds (default: 1 hour) */
  presignedUrlExpiresIn: number;
  /** Artifact retention in days (default: 90) */
  retentionDays: number;
}

/**
 * Load S3 configuration from environment variables.
 * All settings are required except region and expiration.
 */
export function loadS3Config(): S3Config {
  const endpoint = process.env.MERMAID_S3_ENDPOINT;
  const bucket = process.env.MERMAID_S3_BUCKET;
  const accessKeyId = process.env.MERMAID_S3_ACCESS_KEY;
  const secretAccessKey = process.env.MERMAID_S3_SECRET_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing required S3 configuration. Set MERMAID_S3_ENDPOINT, MERMAID_S3_BUCKET, MERMAID_S3_ACCESS_KEY, MERMAID_S3_SECRET_KEY",
    );
  }

  const region = process.env.MERMAID_S3_REGION ?? "us-east-1";

  // Parse and validate presignedUrlExpiresIn
  const presignedUrlExpiresIn = Number.parseInt(
    process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN ?? "3600",
    10,
  );
  if (Number.isNaN(presignedUrlExpiresIn) || presignedUrlExpiresIn <= 0) {
    throw new Error(
      "MERMAID_S3_PRESIGNED_EXPIRES_IN must be a positive integer",
    );
  }
  // AWS SDK constraint: 1-604800 seconds (7 days max)
  if (presignedUrlExpiresIn < 1 || presignedUrlExpiresIn > 604800) {
    throw new Error(
      "MERMAID_S3_PRESIGNED_EXPIRES_IN must be between 1 and 604800 seconds (7 days)",
    );
  }

  // Parse and validate retentionDays
  const retentionDays = Number.parseInt(
    process.env.MERMAID_S3_RETENTION_DAYS ?? "90",
    10,
  );
  if (Number.isNaN(retentionDays) || retentionDays <= 0) {
    throw new Error("MERMAID_S3_RETENTION_DAYS must be a positive integer");
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    presignedUrlExpiresIn,
    retentionDays,
  };
}
