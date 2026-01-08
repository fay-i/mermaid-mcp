/**
 * Behavior tests for LocalStorageBackend tool integration.
 * Tests that tools work correctly with local storage backend.
 * Feature: 010-local-disk-storage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mermaidToSvgWithStorage } from "../../../src/tools/mermaid-to-svg.js";
import { mermaidToPdfWithStorage } from "../../../src/tools/mermaid-to-pdf.js";
import { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import type { StorageBackend } from "../../../src/storage/types.js";

describe("mermaid_to_svg LocalStorageBackend integration", () => {
  let storageBackend: StorageBackend;
  let tempDir: string;
  let hostPath: string;

  beforeEach(async () => {
    // Create temporary directories for container and host paths
    tempDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-test-"));
    hostPath = tempDir; // For testing, host and container paths are the same

    storageBackend = new LocalStorageBackend({
      basePath: tempDir,
      hostPath,
      urlScheme: "file",
    });

    await storageBackend.initialize();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Success path", () => {
    it("returns file:// URL on successful storage", async () => {
      const result = await mermaidToSvgWithStorage(
        { code: "graph TD; A-->B" },
        storageBackend,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.download_url).toMatch(/^file:\/\//);
        expect(result.storage_type).toBe("local");
        expect(result.artifact_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(result.content_type).toBe("image/svg+xml");
        expect(result.size_bytes).toBeGreaterThan(0);
        // Local storage should not have S3 fields
        expect(result.s3).toBeUndefined();
        expect(result.expires_in_seconds).toBeUndefined();
      }
    });

    it("includes curl_command in success response", async () => {
      const result = await mermaidToSvgWithStorage(
        { code: "graph TD; A-->B" },
        storageBackend,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.curl_command).toContain("curl -o");
        expect(result.curl_command).toMatch(/\.svg['"]/);
      }
    });

    it("uses provided sessionId for artifact grouping", async () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";

      const result1 = await mermaidToSvgWithStorage(
        { code: "graph TD; A-->B" },
        storageBackend,
        sessionId,
      );

      const result2 = await mermaidToSvgWithStorage(
        { code: "graph LR; C-->D" },
        storageBackend,
        sessionId,
      );

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok) {
        // Both artifacts should be in the same session directory
        expect(result1.download_url).toContain(sessionId);
        expect(result2.download_url).toContain(sessionId);
      }
    });
  });

  describe("Input validation", () => {
    it("returns INVALID_INPUT for empty code before storage", async () => {
      const result = await mermaidToSvgWithStorage(
        { code: "" },
        storageBackend,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_INPUT");
      }
    });

    it("returns INVALID_TIMEOUT for invalid timeout before storage", async () => {
      const result = await mermaidToSvgWithStorage(
        { code: "graph TD; A-->B", timeout_ms: 500 },
        storageBackend,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_TIMEOUT");
      }
    });
  });
});

describe("mermaid_to_pdf LocalStorageBackend integration", () => {
  let storageBackend: StorageBackend;
  let tempDir: string;
  let hostPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-test-"));
    hostPath = tempDir;

    storageBackend = new LocalStorageBackend({
      basePath: tempDir,
      hostPath,
      urlScheme: "file",
    });

    await storageBackend.initialize();
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Success path", () => {
    it("returns file:// URL on successful storage", async () => {
      const result = await mermaidToPdfWithStorage(
        { code: "graph TD; A-->B" },
        storageBackend,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.download_url).toMatch(/^file:\/\//);
        expect(result.storage_type).toBe("local");
        expect(result.artifact_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(result.content_type).toBe("application/pdf");
        expect(result.size_bytes).toBeGreaterThan(0);
        // Local storage should not have S3 fields
        expect(result.s3).toBeUndefined();
        expect(result.expires_in_seconds).toBeUndefined();
      }
    });
  });
});
