/**
 * Storage Zod Schemas
 * Feature: 010-local-disk-storage
 */

import { z } from "zod";

/**
 * Storage type schema
 */
export const StorageTypeSchema = z.enum(["local", "s3"]);

/**
 * Storage result schema
 */
export const StorageResultSchema = z.object({
  artifact_id: z.string().uuid(),
  download_url: z.string().url(),
  content_type: z.enum(["image/svg+xml", "application/pdf"]),
  size_bytes: z.number().int().positive(),
  storage_type: StorageTypeSchema,
  expires_in_seconds: z.number().int().positive().optional(),
  s3: z
    .object({
      bucket: z.string().min(1),
      key: z.string().min(1),
      region: z.string().min(1),
    })
    .optional(),
});

/**
 * Local storage configuration schema
 */
export const LocalStorageConfigSchema = z.object({
  basePath: z.string().min(1),
  hostPath: z.string().min(1),
  urlScheme: z.enum(["file", "http"]).default("file"),
  cdnHost: z.string().min(1).default("localhost"),
  cdnPort: z.number().int().positive().default(3001),
});

/**
 * S3 storage configuration schema
 */
export const S3StorageConfigSchema = z.object({
  endpoint: z.string().url(),
  bucket: z.string().min(1),
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  presignedUrlExpiry: z.number().int().positive().default(3600),
});

/**
 * Combined storage configuration schema
 */
export const StorageConfigSchema = z.object({
  type: z.enum(["local", "s3", "auto"]),
  local: LocalStorageConfigSchema.optional(),
  s3: S3StorageConfigSchema.optional(),
});
