/**
 * Behavior tests for S3 configuration loading.
 * Tests loadS3Config() validation and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadS3Config } from "../../../src/storage/s3-config.js";

describe("S3 Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear all S3 env vars
    delete process.env.MERMAID_S3_ENDPOINT;
    delete process.env.MERMAID_S3_BUCKET;
    delete process.env.MERMAID_S3_ACCESS_KEY;
    delete process.env.MERMAID_S3_SECRET_KEY;
    delete process.env.MERMAID_S3_REGION;
    delete process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN;
    delete process.env.MERMAID_S3_RETENTION_DAYS;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Required environment variables", () => {
    it("throws error when MERMAID_S3_ENDPOINT is missing", () => {
      process.env.MERMAID_S3_BUCKET = "test-bucket";
      process.env.MERMAID_S3_ACCESS_KEY = "access-key";
      process.env.MERMAID_S3_SECRET_KEY = "secret-key";

      expect(() => loadS3Config()).toThrow(/Missing required S3 configuration/);
    });

    it("throws error when MERMAID_S3_BUCKET is missing", () => {
      process.env.MERMAID_S3_ENDPOINT = "http://localhost:9000";
      process.env.MERMAID_S3_ACCESS_KEY = "access-key";
      process.env.MERMAID_S3_SECRET_KEY = "secret-key";

      expect(() => loadS3Config()).toThrow(/Missing required S3 configuration/);
    });

    it("throws error when MERMAID_S3_ACCESS_KEY is missing", () => {
      process.env.MERMAID_S3_ENDPOINT = "http://localhost:9000";
      process.env.MERMAID_S3_BUCKET = "test-bucket";
      process.env.MERMAID_S3_SECRET_KEY = "secret-key";

      expect(() => loadS3Config()).toThrow(/Missing required S3 configuration/);
    });

    it("throws error when MERMAID_S3_SECRET_KEY is missing", () => {
      process.env.MERMAID_S3_ENDPOINT = "http://localhost:9000";
      process.env.MERMAID_S3_BUCKET = "test-bucket";
      process.env.MERMAID_S3_ACCESS_KEY = "access-key";

      expect(() => loadS3Config()).toThrow(/Missing required S3 configuration/);
    });
  });

  describe("Default values", () => {
    beforeEach(() => {
      process.env.MERMAID_S3_ENDPOINT = "http://localhost:9000";
      process.env.MERMAID_S3_BUCKET = "test-bucket";
      process.env.MERMAID_S3_ACCESS_KEY = "access-key";
      process.env.MERMAID_S3_SECRET_KEY = "secret-key";
    });

    it("uses us-east-1 as default region", () => {
      const config = loadS3Config();
      expect(config.region).toBe("us-east-1");
    });

    it("uses 3600 seconds as default presigned URL expiry", () => {
      const config = loadS3Config();
      expect(config.presignedUrlExpiresIn).toBe(3600);
    });

    it("uses 90 days as default retention period", () => {
      const config = loadS3Config();
      expect(config.retentionDays).toBe(90);
    });
  });

  describe("Valid configuration", () => {
    it("loads all required values correctly", () => {
      process.env.MERMAID_S3_ENDPOINT = "http://minio.example.com:9000";
      process.env.MERMAID_S3_BUCKET = "my-bucket";
      process.env.MERMAID_S3_ACCESS_KEY = "my-access-key";
      process.env.MERMAID_S3_SECRET_KEY = "my-secret-key";
      process.env.MERMAID_S3_REGION = "eu-west-1";
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "7200";
      process.env.MERMAID_S3_RETENTION_DAYS = "30";

      const config = loadS3Config();

      expect(config.endpoint).toBe("http://minio.example.com:9000");
      expect(config.bucket).toBe("my-bucket");
      expect(config.accessKeyId).toBe("my-access-key");
      expect(config.secretAccessKey).toBe("my-secret-key");
      expect(config.region).toBe("eu-west-1");
      expect(config.presignedUrlExpiresIn).toBe(7200);
      expect(config.retentionDays).toBe(30);
    });
  });

  describe("Presigned URL expiry validation", () => {
    beforeEach(() => {
      process.env.MERMAID_S3_ENDPOINT = "http://localhost:9000";
      process.env.MERMAID_S3_BUCKET = "test-bucket";
      process.env.MERMAID_S3_ACCESS_KEY = "access-key";
      process.env.MERMAID_S3_SECRET_KEY = "secret-key";
    });

    it("rejects non-numeric presigned expiry", () => {
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "not-a-number";

      expect(() => loadS3Config()).toThrow(
        /MERMAID_S3_PRESIGNED_EXPIRES_IN must be a positive integer/,
      );
    });

    it("rejects zero presigned expiry", () => {
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "0";

      expect(() => loadS3Config()).toThrow(
        /MERMAID_S3_PRESIGNED_EXPIRES_IN must be a positive integer/,
      );
    });

    it("rejects negative presigned expiry", () => {
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "-100";

      expect(() => loadS3Config()).toThrow(
        /MERMAID_S3_PRESIGNED_EXPIRES_IN must be a positive integer/,
      );
    });

    it("accepts minimum presigned expiry of 1 second", () => {
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "1";

      const config = loadS3Config();
      expect(config.presignedUrlExpiresIn).toBe(1);
    });

    it("accepts maximum presigned expiry of 604800 seconds (7 days)", () => {
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "604800";

      const config = loadS3Config();
      expect(config.presignedUrlExpiresIn).toBe(604800);
    });

    it("rejects presigned expiry exceeding 7 days", () => {
      process.env.MERMAID_S3_PRESIGNED_EXPIRES_IN = "604801";

      expect(() => loadS3Config()).toThrow(
        /must be between 1 and 604800 seconds/,
      );
    });
  });

  describe("Retention days validation", () => {
    beforeEach(() => {
      process.env.MERMAID_S3_ENDPOINT = "http://localhost:9000";
      process.env.MERMAID_S3_BUCKET = "test-bucket";
      process.env.MERMAID_S3_ACCESS_KEY = "access-key";
      process.env.MERMAID_S3_SECRET_KEY = "secret-key";
    });

    it("rejects non-numeric retention days", () => {
      process.env.MERMAID_S3_RETENTION_DAYS = "abc";

      expect(() => loadS3Config()).toThrow(
        /MERMAID_S3_RETENTION_DAYS must be a positive integer/,
      );
    });

    it("rejects zero retention days", () => {
      process.env.MERMAID_S3_RETENTION_DAYS = "0";

      expect(() => loadS3Config()).toThrow(
        /MERMAID_S3_RETENTION_DAYS must be a positive integer/,
      );
    });

    it("rejects negative retention days", () => {
      process.env.MERMAID_S3_RETENTION_DAYS = "-7";

      expect(() => loadS3Config()).toThrow(
        /MERMAID_S3_RETENTION_DAYS must be a positive integer/,
      );
    });

    it("accepts valid retention days", () => {
      process.env.MERMAID_S3_RETENTION_DAYS = "365";

      const config = loadS3Config();
      expect(config.retentionDays).toBe(365);
    });
  });
});
