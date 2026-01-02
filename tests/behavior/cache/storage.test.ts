/**
 * Behavior tests for cache storage layer.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T005, T006, T007: File system operations tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm, readFile, stat } from "node:fs/promises";
import {
  writeArtifactToFile,
  readArtifactFromFile,
  createSessionDirectory,
  deleteSessionDirectory,
  fileExists,
} from "../../../src/cache/storage.js";

describe("Cache Storage Layer", () => {
  let testRoot: string;

  beforeEach(async () => {
    // Create unique test directory for each test
    testRoot = join(tmpdir(), `mermaid-mcp-test-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directory
    await rm(testRoot, { recursive: true, force: true });
  });

  describe("T005: File system write operations", () => {
    it("should write artifact content to a file", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");
      const sessionDir = join(testRoot, sessionId);
      await mkdir(sessionDir, { recursive: true });
      const filePath = join(sessionDir, `${artifactId}.svg`);

      await writeArtifactToFile(filePath, content);

      // Verify file exists
      const exists = await fileExists(filePath);
      expect(exists).toBe(true);

      // Verify content matches
      const written = await readFile(filePath);
      expect(written.toString()).toBe("<svg>test</svg>");
    });

    it("should return the size of the written file", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      const content = Buffer.from("<svg>hello world</svg>", "utf-8");
      const sessionDir = join(testRoot, sessionId);
      await mkdir(sessionDir, { recursive: true });
      const filePath = join(sessionDir, `${artifactId}.svg`);

      const result = await writeArtifactToFile(filePath, content);

      expect(result.sizeBytes).toBe(content.length);
    });

    it("should create parent directories if they do not exist", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");
      // Note: session directory does NOT exist yet
      const filePath = join(testRoot, sessionId, `${artifactId}.svg`);

      await writeArtifactToFile(filePath, content);

      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe("T006: File system read operations", () => {
    it("should read artifact content from a file", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      const content = Buffer.from("<svg>read test</svg>", "utf-8");
      const sessionDir = join(testRoot, sessionId);
      await mkdir(sessionDir, { recursive: true });
      const filePath = join(sessionDir, `${artifactId}.svg`);
      await writeArtifactToFile(filePath, content);

      const read = await readArtifactFromFile(filePath);

      expect(read.toString()).toBe("<svg>read test</svg>");
    });

    it("should throw ARTIFACT_NOT_FOUND error for non-existent file", async () => {
      const filePath = join(testRoot, "nonexistent", "artifact.svg");

      await expect(readArtifactFromFile(filePath)).rejects.toThrow();
    });

    it("should read binary content (PDF) correctly", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      // Simulated PDF header bytes
      const content = Buffer.from([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
      ]);
      const sessionDir = join(testRoot, sessionId);
      await mkdir(sessionDir, { recursive: true });
      const filePath = join(sessionDir, `${artifactId}.pdf`);
      await writeArtifactToFile(filePath, content);

      const read = await readArtifactFromFile(filePath);

      expect(Buffer.compare(read, content)).toBe(0);
    });
  });

  describe("T007: Directory creation and cleanup", () => {
    it("should create a session directory", async () => {
      const sessionId = randomUUID();

      const sessionDir = await createSessionDirectory(testRoot, sessionId);

      expect(sessionDir).toBe(join(testRoot, sessionId));
      const stats = await stat(sessionDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should not fail if session directory already exists", async () => {
      const sessionId = randomUUID();
      const sessionDir = join(testRoot, sessionId);
      await mkdir(sessionDir, { recursive: true });

      // Should not throw
      const result = await createSessionDirectory(testRoot, sessionId);

      expect(result).toBe(sessionDir);
    });

    it("should delete session directory and all contents", async () => {
      const sessionId = randomUUID();
      const sessionDir = join(testRoot, sessionId);
      await mkdir(sessionDir, { recursive: true });
      // Create some files in the session directory
      await writeArtifactToFile(
        join(sessionDir, "artifact1.svg"),
        Buffer.from("<svg>1</svg>"),
      );
      await writeArtifactToFile(
        join(sessionDir, "artifact2.pdf"),
        Buffer.from("PDF"),
      );

      await deleteSessionDirectory(sessionDir);

      const exists = await fileExists(sessionDir);
      expect(exists).toBe(false);
    });

    it("should not fail when deleting non-existent directory", async () => {
      const sessionDir = join(testRoot, "nonexistent");

      // Should not throw
      await deleteSessionDirectory(sessionDir);
    });
  });
});
