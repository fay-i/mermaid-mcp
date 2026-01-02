/**
 * Behavior tests for CacheManager.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T009, T010: CacheManager initialization and metadata tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/manager.js";
import type { CacheConfig } from "../../../src/cache/types.js";

describe("CacheManager", () => {
  let testRoot: string;
  let config: CacheConfig;

  beforeEach(async () => {
    testRoot = join(tmpdir(), `mermaid-mcp-test-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });

    config = {
      rootDirectory: testRoot,
      quotaBytes: 1024 * 1024 * 1024, // 1GB
      enabled: true,
      sessionTimeoutMs: 3600000,
      cleanupIntervalMs: 300000,
    };
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  describe("T009: Cache initialization", () => {
    it("should clear entire cache directory on startup (FR-013)", async () => {
      // Create orphaned session directories from "previous run"
      const orphanSession1 = join(testRoot, randomUUID());
      const orphanSession2 = join(testRoot, randomUUID());
      await mkdir(orphanSession1, { recursive: true });
      await mkdir(orphanSession2, { recursive: true });
      await writeFile(
        join(orphanSession1, "artifact.svg"),
        "<svg>orphan</svg>",
      );

      // Initialize CacheManager - should clear orphans
      const manager = await CacheManager.create(config);
      await manager.shutdown();

      // Verify directory is empty (all orphans cleared)
      const contents = await readdir(testRoot);
      expect(contents).toHaveLength(0);
    });

    it("should create cache root directory if it does not exist", async () => {
      const newRoot = join(testRoot, "new-cache-root");
      const newConfig = { ...config, rootDirectory: newRoot };

      const manager = await CacheManager.create(newConfig);
      await manager.shutdown();

      const contents = await readdir(newRoot);
      expect(contents).toBeDefined();
    });

    it("should report healthy state after successful initialization", async () => {
      const manager = await CacheManager.create(config);

      const state = manager.getState();
      expect(state.isHealthy).toBe(true);
      expect(state.totalSizeBytes).toBe(0);
      expect(state.sessionCount).toBe(0);
      expect(state.artifactCount).toBe(0);

      await manager.shutdown();
    });
  });

  describe("T010: Artifact metadata tracking", () => {
    it("should track artifact size after writing", async () => {
      const manager = await CacheManager.create(config);
      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      const ref = await manager.writeArtifact(
        sessionId,
        content,
        "image/svg+xml",
      );

      const state = manager.getState();
      expect(state.totalSizeBytes).toBe(content.length);
      expect(state.artifactCount).toBe(1);
      expect(ref.size_bytes).toBe(content.length);

      await manager.shutdown();
    });

    it("should track content type correctly", async () => {
      const manager = await CacheManager.create(config);
      const sessionId = randomUUID();
      const svgContent = Buffer.from("<svg>test</svg>", "utf-8");
      const pdfContent = Buffer.from("PDF-content", "utf-8");

      const svgRef = await manager.writeArtifact(
        sessionId,
        svgContent,
        "image/svg+xml",
      );
      const pdfRef = await manager.writeArtifact(
        sessionId,
        pdfContent,
        "application/pdf",
      );

      expect(svgRef.content_type).toBe("image/svg+xml");
      expect(pdfRef.content_type).toBe("application/pdf");

      await manager.shutdown();
    });

    it("should track artifact path as file URI", async () => {
      const manager = await CacheManager.create(config);
      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      const ref = await manager.writeArtifact(
        sessionId,
        content,
        "image/svg+xml",
      );

      expect(ref.uri).toMatch(/^file:\/\//);
      expect(ref.uri).toContain(sessionId);
      expect(ref.uri).toContain(ref.artifact_id);
      expect(ref.uri.endsWith(".svg")).toBe(true);

      await manager.shutdown();
    });

    it("should track multiple artifacts per session", async () => {
      const manager = await CacheManager.create(config);
      const sessionId = randomUUID();
      const content1 = Buffer.from("<svg>1</svg>", "utf-8");
      const content2 = Buffer.from("<svg>22</svg>", "utf-8");

      await manager.writeArtifact(sessionId, content1, "image/svg+xml");
      await manager.writeArtifact(sessionId, content2, "image/svg+xml");

      const state = manager.getState();
      expect(state.artifactCount).toBe(2);
      expect(state.totalSizeBytes).toBe(content1.length + content2.length);
      expect(state.sessionCount).toBe(1);

      await manager.shutdown();
    });

    it("should track multiple sessions", async () => {
      const manager = await CacheManager.create(config);
      const session1 = randomUUID();
      const session2 = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      await manager.writeArtifact(session1, content, "image/svg+xml");
      await manager.writeArtifact(session2, content, "image/svg+xml");

      const state = manager.getState();
      expect(state.sessionCount).toBe(2);
      expect(state.artifactCount).toBe(2);

      await manager.shutdown();
    });
  });
});
