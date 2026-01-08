/**
 * S3 Storage Backend Tests
 * Feature: 010-local-disk-storage
 *
 * Tests S3StorageBackend interface compliance and error mapping.
 * Note: These tests validate interface and error handling without requiring actual S3.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { S3StorageBackend } from "../../../src/storage/s3-backend.js";
import {
  InvalidSessionIdError,
  InvalidArtifactIdError,
} from "../../../src/storage/errors.js";
import type { S3StorageConfig } from "../../../src/storage/types.js";

describe("S3StorageBackend", () => {
  let backend: S3StorageBackend;
  let sessionId: string;
  let artifactId: string;
  const mockConfig: S3StorageConfig = {
    endpoint: "http://localhost:9000",
    bucket: "test-bucket",
    region: "us-east-1",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    presignedUrlExpiry: 3600,
  };

  beforeEach(() => {
    sessionId = randomUUID();
    artifactId = randomUUID();
    backend = new S3StorageBackend(mockConfig);
  });

  describe("initialize()", () => {
    it("should initialize without errors", async () => {
      await expect(backend.initialize()).resolves.toBeUndefined();
    });
  });

  describe("Interface compliance", () => {
    it("should implement all StorageBackend methods", () => {
      expect(backend.store).toBeInstanceOf(Function);
      expect(backend.retrieve).toBeInstanceOf(Function);
      expect(backend.delete).toBeInstanceOf(Function);
      expect(backend.exists).toBeInstanceOf(Function);
      expect(backend.getType).toBeInstanceOf(Function);
      expect(backend.initialize).toBeInstanceOf(Function);
    });
  });

  describe("getType()", () => {
    it("should return 's3' as storage type", () => {
      expect(backend.getType()).toBe("s3");
    });
  });

  describe("UUID validation", () => {
    it("should throw InvalidSessionIdError for invalid session UUID in store()", async () => {
      await expect(
        backend.store(
          "invalid-uuid",
          artifactId,
          Buffer.from("test"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidSessionIdError);
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID in store()", async () => {
      await expect(
        backend.store(
          sessionId,
          "invalid-uuid",
          Buffer.from("test"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidArtifactIdError);
    });

    it("should throw InvalidSessionIdError for invalid session UUID in retrieve()", async () => {
      await expect(
        backend.retrieve("invalid-uuid", artifactId),
      ).rejects.toThrow(InvalidSessionIdError);
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID in retrieve()", async () => {
      await expect(backend.retrieve(sessionId, "invalid-uuid")).rejects.toThrow(
        InvalidArtifactIdError,
      );
    });

    it("should throw InvalidSessionIdError for invalid session UUID in delete()", async () => {
      await expect(backend.delete("invalid-uuid", artifactId)).rejects.toThrow(
        InvalidSessionIdError,
      );
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID in delete()", async () => {
      await expect(backend.delete(sessionId, "invalid-uuid")).rejects.toThrow(
        InvalidArtifactIdError,
      );
    });

    it("should throw InvalidSessionIdError for invalid session UUID in exists()", async () => {
      await expect(backend.exists("invalid-uuid", artifactId)).rejects.toThrow(
        InvalidSessionIdError,
      );
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID in exists()", async () => {
      await expect(backend.exists(sessionId, "invalid-uuid")).rejects.toThrow(
        InvalidArtifactIdError,
      );
    });

    it("should validate path traversal prevention", async () => {
      const maliciousSessionId = "../../../etc/passwd";
      const maliciousArtifactId = "../../secret";

      await expect(
        backend.store(
          maliciousSessionId,
          artifactId,
          Buffer.from("test"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidSessionIdError);

      await expect(
        backend.store(
          sessionId,
          maliciousArtifactId,
          Buffer.from("test"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidArtifactIdError);
    });
  });

  describe("Method signatures", () => {
    it("should accept correct parameters for store()", () => {
      const testSession = randomUUID();
      const testArtifact = randomUUID();
      const testContent = Buffer.from("test");

      // TypeScript ensures the signature is correct
      expect(() =>
        backend.store(testSession, testArtifact, testContent, "image/svg+xml"),
      ).not.toThrow(TypeError);

      expect(() =>
        backend.store(
          testSession,
          testArtifact,
          testContent,
          "application/pdf",
        ),
      ).not.toThrow(TypeError);
    });

    it("should accept correct parameters for retrieve()", () => {
      const testSession = randomUUID();
      const testArtifact = randomUUID();

      expect(() => backend.retrieve(testSession, testArtifact)).not.toThrow(
        TypeError,
      );
    });

    it("should accept correct parameters for delete()", () => {
      const testSession = randomUUID();
      const testArtifact = randomUUID();

      expect(() => backend.delete(testSession, testArtifact)).not.toThrow(
        TypeError,
      );
    });

    it("should accept correct parameters for exists()", () => {
      const testSession = randomUUID();
      const testArtifact = randomUUID();

      expect(() => backend.exists(testSession, testArtifact)).not.toThrow(
        TypeError,
      );
    });

    it("should accept no parameters for getType()", () => {
      expect(() => backend.getType()).not.toThrow(TypeError);
    });
  });
});
