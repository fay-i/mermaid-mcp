/**
 * Storage Factory Tests
 * Feature: 010-local-disk-storage
 *
 * Tests backend selection logic and auto-detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStorageBackend } from "../../../src/storage/factory.js";
import { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import { S3StorageBackend } from "../../../src/storage/s3-backend.js";
import { ConfigurationError } from "../../../src/storage/errors.js";

describe("Storage Factory", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temporary directory for local storage tests
    tempDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-factory-test-"));
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("STORAGE_TYPE=local", () => {
    it("should create LocalStorageBackend when STORAGE_TYPE=local", async () => {
      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = tempDir;

      const backend = await createStorageBackend();

      expect(backend).toBeInstanceOf(LocalStorageBackend);
      expect(backend.getType()).toBe("local");
    });

    it("should throw ConfigurationError when CONTAINER_STORAGE_PATH is missing", async () => {
      process.env.STORAGE_TYPE = "local";
      delete process.env.CONTAINER_STORAGE_PATH;

      await expect(createStorageBackend()).rejects.toThrow(ConfigurationError);
      await expect(createStorageBackend()).rejects.toThrow(
        /CONTAINER_STORAGE_PATH/,
      );
    });

    it("should log selected backend", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = tempDir;

      await createStorageBackend();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[StorageFactory] Selected backend: Local"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("STORAGE_TYPE=s3", () => {
    it("should create S3StorageBackend when STORAGE_TYPE=s3", async () => {
      process.env.STORAGE_TYPE = "s3";
      process.env.S3_ENDPOINT = "http://localhost:9000";
      process.env.S3_BUCKET = "test-bucket";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
      process.env.AWS_REGION = "us-east-1";

      const backend = await createStorageBackend();

      expect(backend).toBeInstanceOf(S3StorageBackend);
      expect(backend.getType()).toBe("s3");
    });

    it("should throw ConfigurationError when S3 credentials are missing", async () => {
      process.env.STORAGE_TYPE = "s3";
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      await expect(createStorageBackend()).rejects.toThrow(ConfigurationError);
      await expect(createStorageBackend()).rejects.toThrow(
        /S3_ENDPOINT|S3_BUCKET|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/,
      );
    });

    it("should log selected backend", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      process.env.STORAGE_TYPE = "s3";
      process.env.S3_ENDPOINT = "http://localhost:9000";
      process.env.S3_BUCKET = "test-bucket";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
      process.env.AWS_REGION = "us-east-1";

      await createStorageBackend();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[StorageFactory] Selected backend: S3"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("STORAGE_TYPE=auto (auto-detection)", () => {
    it("should auto-detect LocalStorageBackend when only local is configured", async () => {
      process.env.STORAGE_TYPE = "auto";
      process.env.CONTAINER_STORAGE_PATH = tempDir;
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      const backend = await createStorageBackend();

      expect(backend).toBeInstanceOf(LocalStorageBackend);
      expect(backend.getType()).toBe("local");
    });

    it("should auto-detect S3StorageBackend when only S3 is configured", async () => {
      process.env.STORAGE_TYPE = "auto";
      delete process.env.CONTAINER_STORAGE_PATH;
      process.env.S3_ENDPOINT = "http://localhost:9000";
      process.env.S3_BUCKET = "test-bucket";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

      const backend = await createStorageBackend();

      expect(backend).toBeInstanceOf(S3StorageBackend);
      expect(backend.getType()).toBe("s3");
    });

    it("should throw ConfigurationError when both local and S3 are configured (FR-011a)", async () => {
      process.env.STORAGE_TYPE = "auto";
      process.env.CONTAINER_STORAGE_PATH = tempDir;
      process.env.S3_ENDPOINT = "http://localhost:9000";
      process.env.S3_BUCKET = "test-bucket";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

      await expect(createStorageBackend()).rejects.toThrow(ConfigurationError);
      await expect(createStorageBackend()).rejects.toThrow(
        /cannot have both local and S3 configured/,
      );
    });

    it("should throw ConfigurationError when neither local nor S3 is configured", async () => {
      process.env.STORAGE_TYPE = "auto";
      delete process.env.CONTAINER_STORAGE_PATH;
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      await expect(createStorageBackend()).rejects.toThrow(ConfigurationError);
      await expect(createStorageBackend()).rejects.toThrow(
        /requires either local.*or S3/,
      );
    });

    it("should log auto-detected backend for local", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      process.env.STORAGE_TYPE = "auto";
      process.env.CONTAINER_STORAGE_PATH = tempDir;
      delete process.env.S3_ENDPOINT;

      await createStorageBackend();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[StorageFactory] Auto-detected backend: Local",
        ),
      );
      consoleSpy.mockRestore();
    });

    it("should log auto-detected backend for S3", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      process.env.STORAGE_TYPE = "auto";
      delete process.env.CONTAINER_STORAGE_PATH;
      process.env.S3_ENDPOINT = "http://localhost:9000";
      process.env.S3_BUCKET = "test-bucket";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

      await createStorageBackend();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[StorageFactory] Auto-detected backend: S3"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("Default behavior (no STORAGE_TYPE)", () => {
    it("should default to auto-detection when STORAGE_TYPE is not set", async () => {
      delete process.env.STORAGE_TYPE;
      process.env.CONTAINER_STORAGE_PATH = tempDir;
      delete process.env.S3_ENDPOINT;

      const backend = await createStorageBackend();

      expect(backend).toBeInstanceOf(LocalStorageBackend);
    });
  });

  describe("Initialization", () => {
    it("should initialize LocalStorageBackend on creation", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      process.env.STORAGE_TYPE = "local";
      process.env.CONTAINER_STORAGE_PATH = tempDir;

      await createStorageBackend();

      // Should see both factory selection log and backend initialization log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[StorageFactory] Selected backend: Local"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LocalStorage] Write access validated"),
      );

      consoleSpy.mockRestore();
    });

    it("should initialize S3StorageBackend on creation", async () => {
      const consoleSpy = vi.spyOn(console, "error");

      process.env.STORAGE_TYPE = "s3";
      process.env.S3_ENDPOINT = "http://localhost:9000";
      process.env.S3_BUCKET = "test-bucket";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

      await createStorageBackend();

      // Should see both factory selection log and backend initialization log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[StorageFactory] Selected backend: S3"),
      );
      // Backend now uses structured logging (JSON format)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("S3 storage backend initialized"),
      );

      consoleSpy.mockRestore();
    });
  });
});
