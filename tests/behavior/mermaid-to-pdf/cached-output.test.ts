/**
 * Behavior tests for mermaid_to_pdf cached output.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T014: Contract test for cached output schema.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, readFile } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import type { CacheConfig } from "../../../src/cache/types.js";
import { mermaidToPdfCached } from "../../../src/tools/mermaid-to-pdf.js";

describe("mermaid_to_pdf with caching", () => {
  let testRoot: string;
  let config: CacheConfig;
  let cacheManager: CacheManager;

  beforeEach(async () => {
    testRoot = join(tmpdir(), `mermaid-mcp-test-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });

    config = {
      rootDirectory: testRoot,
      quotaBytes: 1024 * 1024 * 1024,
      enabled: true,
      sessionTimeoutMs: 3600000,
      cleanupIntervalMs: 0,
    };
    cacheManager = await CacheManager.create(config);
  });

  afterEach(async () => {
    await cacheManager.shutdown();
    await rm(testRoot, { recursive: true, force: true });
  });

  describe("T014: Contract test for cached output schema", () => {
    it("should return artifact reference in cached mode", async () => {
      const sessionId = randomUUID();
      const input = { code: "graph TD; A-->B" };

      const result = await mermaidToPdfCached(input, sessionId, cacheManager);

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("cached");
      if (result.ok && result.mode === "cached") {
        expect(result.artifact).toBeDefined();
        expect(result.artifact.artifact_id).toBeDefined();
        expect(result.artifact.uri).toMatch(/^file:\/\//);
        expect(result.artifact.content_type).toBe("application/pdf");
        expect(result.artifact.size_bytes).toBeGreaterThan(0);
      }
    });

    it("should include request_id in response", async () => {
      const sessionId = randomUUID();
      const input = { code: "graph TD; A-->B" };

      const result = await mermaidToPdfCached(input, sessionId, cacheManager);

      expect(result.request_id).toBeDefined();
      expect(result.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should have empty errors array on success", async () => {
      const sessionId = randomUUID();
      const input = { code: "graph TD; A-->B" };

      const result = await mermaidToPdfCached(input, sessionId, cacheManager);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should write PDF file to disk", async () => {
      const sessionId = randomUUID();
      const input = { code: "graph TD; A-->B" };

      const result = await mermaidToPdfCached(input, sessionId, cacheManager);

      expect(result.ok).toBe(true);
      if (result.ok && result.mode === "cached") {
        const filePath = result.artifact.uri.replace("file://", "");
        const stats = await stat(filePath);
        expect(stats.isFile()).toBe(true);
      }
    });

    it("should write valid PDF content to file", async () => {
      const sessionId = randomUUID();
      const input = { code: "graph TD; A-->B" };

      const result = await mermaidToPdfCached(input, sessionId, cacheManager);

      expect(result.ok).toBe(true);
      if (result.ok && result.mode === "cached") {
        const filePath = result.artifact.uri.replace("file://", "");
        const content = await readFile(filePath);
        // PDF files start with %PDF
        expect(content.slice(0, 4).toString()).toBe("%PDF");
      }
    });
  });
});
