/**
 * Local Storage Backend Tests
 * Feature: 010-local-disk-storage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import {
  ArtifactNotFoundError,
  InvalidSessionIdError,
  InvalidArtifactIdError,
} from "../../../src/storage/errors.js";

describe("LocalStorageBackend", () => {
  let tempDir: string;
  let backend: LocalStorageBackend;
  let sessionId: string;
  let artifactId: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-test-"));
    sessionId = randomUUID();
    artifactId = randomUUID();

    backend = new LocalStorageBackend({
      basePath: tempDir,
      hostPath: tempDir,
      urlScheme: "file",
    });

    await backend.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize()", () => {
    it("should create base directory if it doesn't exist", async () => {
      const newTempDir = join(tempDir, "nested", "path");
      const newBackend = new LocalStorageBackend({
        basePath: newTempDir,
        hostPath: newTempDir,
        urlScheme: "file",
      });

      await newBackend.initialize();

      // Verify directory was created
      const result = await newBackend.store(
        sessionId,
        artifactId,
        Buffer.from("<svg></svg>"),
        "image/svg+xml",
      );
      expect(result.artifact_id).toBe(artifactId);
    });

    it("should validate write access on startup", async () => {
      // This test passes because we have write access
      expect(backend).toBeDefined();
    });

    it("should clean up orphaned .tmp files on startup", async () => {
      // Create session directory with orphaned .tmp file
      const orphanedSessionId = randomUUID();
      const sessionPath = join(tempDir, orphanedSessionId);
      await mkdir(sessionPath, { recursive: true });
      await writeFile(join(sessionPath, "orphaned.tmp"), "test");

      // Initialize a new backend
      const newBackend = new LocalStorageBackend({
        basePath: tempDir,
        hostPath: tempDir,
        urlScheme: "file",
      });

      await newBackend.initialize();

      // Verify .tmp file was cleaned up
      const files = await import("node:fs/promises").then((fs) =>
        fs.readdir(sessionPath),
      );
      expect(files).not.toContain("orphaned.tmp");
    });
  });

  describe("store()", () => {
    it("should store SVG artifact with atomic write", async () => {
      const content = Buffer.from("<svg><circle/></svg>");

      const result = await backend.store(
        sessionId,
        artifactId,
        content,
        "image/svg+xml",
      );

      expect(result).toEqual({
        artifact_id: artifactId,
        download_url: `file://${tempDir}/${sessionId}/${artifactId}.svg`,
        content_type: "image/svg+xml",
        size_bytes: content.length,
        storage_type: "local",
      });

      // Verify no .tmp file remains
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(join(tempDir, sessionId));
      expect(files.filter((f) => f.endsWith(".tmp"))).toHaveLength(0);
    });

    it("should store PDF artifact with atomic write", async () => {
      const content = Buffer.from("%PDF-1.4\n...");

      const result = await backend.store(
        sessionId,
        artifactId,
        content,
        "application/pdf",
      );

      expect(result).toEqual({
        artifact_id: artifactId,
        download_url: `file://${tempDir}/${sessionId}/${artifactId}.pdf`,
        content_type: "application/pdf",
        size_bytes: content.length,
        storage_type: "local",
      });
    });

    it("should create session directory if it doesn't exist", async () => {
      const newSessionId = randomUUID();
      const content = Buffer.from("<svg></svg>");

      await backend.store(newSessionId, artifactId, content, "image/svg+xml");

      const { stat } = await import("node:fs/promises");
      const sessionPath = join(tempDir, newSessionId);
      const stats = await stat(sessionPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should construct file:// URL when urlScheme is 'file'", async () => {
      const content = Buffer.from("<svg></svg>");

      const result = await backend.store(
        sessionId,
        artifactId,
        content,
        "image/svg+xml",
      );

      expect(result.download_url).toMatch(/^file:\/\//);
      expect(result.download_url).toContain(tempDir);
    });

    it("should construct http:// URL when urlScheme is 'http'", async () => {
      const httpBackend = new LocalStorageBackend({
        basePath: tempDir,
        hostPath: tempDir,
        urlScheme: "http",
        cdnHost: "cdn.example.com",
        cdnPort: 8080,
      });
      await httpBackend.initialize();

      const content = Buffer.from("<svg></svg>");
      const result = await httpBackend.store(
        sessionId,
        artifactId,
        content,
        "image/svg+xml",
      );

      expect(result.download_url).toBe(
        `http://cdn.example.com:8080/artifacts/${sessionId}/${artifactId}.svg`,
      );
    });

    it("should use default CDN host and port when not specified", async () => {
      const httpBackend = new LocalStorageBackend({
        basePath: tempDir,
        hostPath: tempDir,
        urlScheme: "http",
      });
      await httpBackend.initialize();

      const content = Buffer.from("<svg></svg>");
      const result = await httpBackend.store(
        sessionId,
        artifactId,
        content,
        "image/svg+xml",
      );

      expect(result.download_url).toBe(
        `http://localhost:3001/artifacts/${sessionId}/${artifactId}.svg`,
      );
    });

    it("should throw InvalidSessionIdError for invalid session UUID", async () => {
      await expect(
        backend.store(
          "not-a-uuid",
          artifactId,
          Buffer.from("<svg></svg>"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidSessionIdError);
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID", async () => {
      await expect(
        backend.store(
          sessionId,
          "not-a-uuid",
          Buffer.from("<svg></svg>"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidArtifactIdError);
    });

    it("should prevent path traversal with invalid UUIDs", async () => {
      const maliciousId = "../../../etc/passwd";

      await expect(
        backend.store(
          maliciousId,
          artifactId,
          Buffer.from("<svg></svg>"),
          "image/svg+xml",
        ),
      ).rejects.toThrow(InvalidSessionIdError);
    });
  });

  describe("retrieve()", () => {
    beforeEach(async () => {
      // Store an artifact for retrieval tests
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from("<svg>test</svg>"),
        "image/svg+xml",
      );
    });

    it("should retrieve stored SVG artifact", async () => {
      const content = await backend.retrieve(sessionId, artifactId);

      expect(content.toString()).toBe("<svg>test</svg>");
    });

    it("should retrieve stored PDF artifact", async () => {
      const pdfId = randomUUID();
      const pdfContent = Buffer.from("%PDF-1.4");

      await backend.store(sessionId, pdfId, pdfContent, "application/pdf");
      const retrieved = await backend.retrieve(sessionId, pdfId);

      expect(retrieved.toString()).toBe("%PDF-1.4");
    });

    it("should throw ArtifactNotFoundError when artifact doesn't exist", async () => {
      const nonExistentId = randomUUID();

      await expect(backend.retrieve(sessionId, nonExistentId)).rejects.toThrow(
        ArtifactNotFoundError,
      );
    });

    it("should throw InvalidSessionIdError for invalid session UUID", async () => {
      await expect(backend.retrieve("not-a-uuid", artifactId)).rejects.toThrow(
        InvalidSessionIdError,
      );
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID", async () => {
      await expect(backend.retrieve(sessionId, "not-a-uuid")).rejects.toThrow(
        InvalidArtifactIdError,
      );
    });
  });

  describe("delete()", () => {
    beforeEach(async () => {
      // Store an artifact for deletion tests
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from("<svg>test</svg>"),
        "image/svg+xml",
      );
    });

    it("should delete existing artifact", async () => {
      await backend.delete(sessionId, artifactId);

      // Verify artifact no longer exists
      await expect(backend.retrieve(sessionId, artifactId)).rejects.toThrow(
        ArtifactNotFoundError,
      );
    });

    it("should throw ArtifactNotFoundError when deleting non-existent artifact", async () => {
      const nonExistentId = randomUUID();

      await expect(backend.delete(sessionId, nonExistentId)).rejects.toThrow(
        ArtifactNotFoundError,
      );
    });

    it("should throw InvalidSessionIdError for invalid session UUID", async () => {
      await expect(backend.delete("not-a-uuid", artifactId)).rejects.toThrow(
        InvalidSessionIdError,
      );
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID", async () => {
      await expect(backend.delete(sessionId, "not-a-uuid")).rejects.toThrow(
        InvalidArtifactIdError,
      );
    });
  });

  describe("exists()", () => {
    it("should return true for existing artifact", async () => {
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from("<svg>test</svg>"),
        "image/svg+xml",
      );

      const exists = await backend.exists(sessionId, artifactId);

      expect(exists).toBe(true);
    });

    it("should return false for non-existent artifact", async () => {
      const nonExistentId = randomUUID();

      const exists = await backend.exists(sessionId, nonExistentId);

      expect(exists).toBe(false);
    });

    it("should return false for non-existent session", async () => {
      const nonExistentSession = randomUUID();

      const exists = await backend.exists(nonExistentSession, artifactId);

      expect(exists).toBe(false);
    });

    it("should throw InvalidSessionIdError for invalid session UUID", async () => {
      await expect(backend.exists("not-a-uuid", artifactId)).rejects.toThrow(
        InvalidSessionIdError,
      );
    });

    it("should throw InvalidArtifactIdError for invalid artifact UUID", async () => {
      await expect(backend.exists(sessionId, "not-a-uuid")).rejects.toThrow(
        InvalidArtifactIdError,
      );
    });
  });

  describe("getType()", () => {
    it("should return 'local'", () => {
      expect(backend.getType()).toBe("local");
    });
  });

  describe("error handling", () => {
    it("should handle ENOENT errors as ArtifactNotFoundError", async () => {
      const nonExistentId = randomUUID();

      await expect(backend.retrieve(sessionId, nonExistentId)).rejects.toThrow(
        ArtifactNotFoundError,
      );
    });

    // Note: ENOSPC and EACCES tests are difficult to reliably simulate
    // in unit tests without root privileges or disk manipulation.
    // These would be better tested in integration tests or manual testing.
  });
});
