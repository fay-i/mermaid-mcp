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
  const presignedUrlExpiresIn = Number(
    process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN ?? "3600",
  );
  const retentionDays = Number(process.env.MERMAID_S3_RETENTION_DAYS ?? "90");

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
