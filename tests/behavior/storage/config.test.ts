/**
 * Storage Configuration Tests
 * Feature: 010-local-disk-storage
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadStorageConfig } from "../../../src/storage/config.js";
import { ConfigurationError } from "../../../src/storage/errors.js";

describe("loadStorageConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.STORAGE_TYPE;
    delete process.env.CONTAINER_STORAGE_PATH;
    delete process.env.HOST_STORAGE_PATH;
    delete process.env.LOCAL_URL_SCHEME;
    delete process.env.CDN_HOST;
    delete process.env.CDN_PORT;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_PRESIGNED_URL_EXPIRY;
  });

  describe("STORAGE_TYPE=local", () => {
    it("should return LocalStorageConfig with valid configuration", () => {
      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";
      process.env.HOST_STORAGE_PATH = "/Users/dev/artifacts";

      const config = loadStorageConfig();

      expect(config.type).toBe("local");
      expect(config.local).toBeDefined();
      expect(config.local?.basePath).toBe("/app/data/artifacts");
      expect(config.local?.hostPath).toBe("/Users/dev/artifacts");
      expect(config.local?.urlScheme).toBe("file");
    });

    it("should use container path as host path if not specified", () => {
      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";

      const config = loadStorageConfig();

      expect(config.local?.hostPath).toBe("/app/data/artifacts");
    });

    it("should throw ConfigurationError if CONTAINER_STORAGE_PATH missing", () => {
      process.env.STORAGE_TYPE = "local";

      expect(() => loadStorageConfig()).toThrow(ConfigurationError);
      expect(() => loadStorageConfig()).toThrow(
        "STORAGE_TYPE=local requires CONTAINER_STORAGE_PATH",
      );
    });

    it("should support http URL scheme", () => {
      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";
      process.env.LOCAL_URL_SCHEME = "http";
      process.env.CDN_HOST = "cdn.example.com";
      process.env.CDN_PORT = "8080";

      const config = loadStorageConfig();

      expect(config.local?.urlScheme).toBe("http");
      expect(config.local?.cdnHost).toBe("cdn.example.com");
      expect(config.local?.cdnPort).toBe(8080);
    });

    it("should use default CDN settings if not specified", () => {
      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";
      process.env.LOCAL_URL_SCHEME = "http";

      const config = loadStorageConfig();

      expect(config.local?.cdnHost).toBe("localhost");
      expect(config.local?.cdnPort).toBe(3001);
    });
  });

  describe("STORAGE_TYPE=s3", () => {
    it("should return S3StorageConfig with valid credentials", () => {
      process.env.STORAGE_TYPE = "s3";
      process.env.S3_ENDPOINT = "https://s3.amazonaws.com";
      process.env.S3_BUCKET = "my-bucket";
      process.env.AWS_REGION = "us-west-2";
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY =
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

      const config = loadStorageConfig();

      expect(config.type).toBe("s3");
      expect(config.s3).toBeDefined();
      expect(config.s3?.endpoint).toBe("https://s3.amazonaws.com");
      expect(config.s3?.bucket).toBe("my-bucket");
      expect(config.s3?.region).toBe("us-west-2");
      expect(config.s3?.accessKeyId).toBe("AKIAIOSFODNN7EXAMPLE");
    });

    it("should use default region if not specified", () => {
      process.env.STORAGE_TYPE = "s3";
      process.env.S3_ENDPOINT = "https://s3.amazonaws.com";
      process.env.S3_BUCKET = "my-bucket";
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY =
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

      const config = loadStorageConfig();

      expect(config.s3?.region).toBe("us-east-1");
    });

    it("should throw ConfigurationError if S3 credentials missing", () => {
      process.env.STORAGE_TYPE = "s3";

      expect(() => loadStorageConfig()).toThrow(ConfigurationError);
      expect(() => loadStorageConfig()).toThrow("STORAGE_TYPE=s3 requires");
    });

    it("should support custom presigned URL expiry", () => {
      process.env.STORAGE_TYPE = "s3";
      process.env.S3_ENDPOINT = "https://s3.amazonaws.com";
      process.env.S3_BUCKET = "my-bucket";
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY =
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      process.env.S3_PRESIGNED_URL_EXPIRY = "7200";

      const config = loadStorageConfig();

      expect(config.s3?.presignedUrlExpiry).toBe(7200);
    });
  });

  describe("STORAGE_TYPE=auto", () => {
    it("should select S3 backend when S3 credentials present", () => {
      process.env.STORAGE_TYPE = "auto";
      process.env.S3_ENDPOINT = "https://s3.amazonaws.com";
      process.env.S3_BUCKET = "my-bucket";
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY =
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

      const config = loadStorageConfig();

      expect(config.type).toBe("auto");
      expect(config.s3).toBeDefined();
      expect(config.local).toBeUndefined();
    });

    it("should select local backend when local path present", () => {
      process.env.STORAGE_TYPE = "auto";
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";

      const config = loadStorageConfig();

      expect(config.type).toBe("auto");
      expect(config.local).toBeDefined();
      expect(config.s3).toBeUndefined();
    });

    it("should throw ConfigurationError if both backends configured", () => {
      process.env.STORAGE_TYPE = "auto";
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";
      process.env.S3_ENDPOINT = "https://s3.amazonaws.com";
      process.env.S3_BUCKET = "my-bucket";
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY =
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

      expect(() => loadStorageConfig()).toThrow(ConfigurationError);
      expect(() => loadStorageConfig()).toThrow(
        "cannot have both local and S3 configured",
      );
    });

    it("should throw ConfigurationError if neither backend configured", () => {
      process.env.STORAGE_TYPE = "auto";

      expect(() => loadStorageConfig()).toThrow(ConfigurationError);
      expect(() => loadStorageConfig()).toThrow("requires either local");
    });

    it("should default to auto when STORAGE_TYPE not set", () => {
      process.env.CONTAINER_STORAGE_PATH = "/app/data/artifacts";

      const config = loadStorageConfig();

      expect(config.type).toBe("auto");
      expect(config.local).toBeDefined();
    });
  });
});
