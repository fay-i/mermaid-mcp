/**
 * Behavior tests for storage quota management and LRU eviction.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T044, T045, T046: LRU eviction, 90% quota target, quota tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import { fileExists } from "../../../src/cache/storage.js";
import type { CacheConfig } from "../../../src/cache/types.js";

describe("Storage Quota Management", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = join(tmpdir(), `mermaid-mcp-test-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  describe("T044: LRU eviction when quota exceeded", () => {
    it("should evict oldest artifact when quota is exceeded", async () => {
      // Very small quota: 100 bytes
      const config: CacheConfig = {
        rootDirectory: testRoot,
        quotaBytes: 100,
        enabled: true,
        sessionTimeoutMs: 3600000,
        cleanupIntervalMs: 0,
      };
      const cacheManager = await CacheManager.create(config);
      const sessionId = randomUUID();

      // Create content that's 30 bytes each
      const content1 = Buffer.from("a".repeat(30), "utf-8");
      const content2 = Buffer.from("b".repeat(30), "utf-8");
      const content3 = Buffer.from("c".repeat(30), "utf-8");

      // Write 3 artifacts (90 bytes total, under quota)
      const ref1 = await cacheManager.writeArtifact(
        sessionId,
        content1,
        "image/svg+xml",
      );
      await new Promise((r) => setTimeout(r, 10)); // Small delay for different timestamps
      const ref2 = await cacheManager.writeArtifact(
        sessionId,
        content2,
        "image/svg+xml",
      );
      await new Promise((r) => setTimeout(r, 10));
      const ref3 = await cacheManager.writeArtifact(
        sessionId,
        content3,
        "image/svg+xml",
      );

      // Write 4th artifact (would exceed quota)
      const content4 = Buffer.from("d".repeat(30), "utf-8");
      await cacheManager.writeArtifact(sessionId, content4, "image/svg+xml");

      // First artifact should be evicted (LRU)
      const file1 = ref1.uri.replace("file://", "");
      expect(await fileExists(file1)).toBe(false);

      await cacheManager.shutdown();
    });
  });

  describe("T045: Eviction to 90% quota", () => {
    it("should evict until below 90% quota", async () => {
      // 100 bytes quota, 90% = 90 bytes
      const config: CacheConfig = {
        rootDirectory: testRoot,
        quotaBytes: 100,
        enabled: true,
        sessionTimeoutMs: 3600000,
        cleanupIntervalMs: 0,
      };
      const cacheManager = await CacheManager.create(config);
      const sessionId = randomUUID();

      // Create 40-byte artifacts
      const content = Buffer.from("x".repeat(40), "utf-8");

      // Write 2 artifacts (80 bytes, under 90% quota)
      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");
      await new Promise((r) => setTimeout(r, 10));
      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");

      // Write 3rd artifact (would be 120 bytes, exceeds quota)
      // Should evict until below 90 bytes
      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");

      const state = cacheManager.getState();
      // Should have evicted at least one, keeping total under 90 bytes
      expect(state.totalSizeBytes).toBeLessThanOrEqual(90);

      await cacheManager.shutdown();
    });
  });

  describe("T046: Quota tracking accuracy", () => {
    it("should accurately track total size across all artifacts", async () => {
      const config: CacheConfig = {
        rootDirectory: testRoot,
        quotaBytes: 1024 * 1024,
        enabled: true,
        sessionTimeoutMs: 3600000,
        cleanupIntervalMs: 0,
      };
      const cacheManager = await CacheManager.create(config);

      const session1 = randomUUID();
      const session2 = randomUUID();

      const content1 = Buffer.from("a".repeat(100), "utf-8");
      const content2 = Buffer.from("b".repeat(200), "utf-8");
      const content3 = Buffer.from("c".repeat(300), "utf-8");

      await cacheManager.writeArtifact(session1, content1, "image/svg+xml");
      await cacheManager.writeArtifact(session1, content2, "image/svg+xml");
      await cacheManager.writeArtifact(session2, content3, "image/svg+xml");

      const state = cacheManager.getState();
      expect(state.totalSizeBytes).toBe(100 + 200 + 300);
      expect(state.artifactCount).toBe(3);
      expect(state.sessionCount).toBe(2);

      await cacheManager.shutdown();
    });

    it("should update total size after cleanup", async () => {
      const config: CacheConfig = {
        rootDirectory: testRoot,
        quotaBytes: 1024 * 1024,
        enabled: true,
        sessionTimeoutMs: 3600000,
        cleanupIntervalMs: 0,
      };
      const cacheManager = await CacheManager.create(config);

      const sessionId = randomUUID();
      const content = Buffer.from("x".repeat(100), "utf-8");

      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");
      expect(cacheManager.getState().totalSizeBytes).toBe(100);

      await cacheManager.cleanupSession(sessionId);
      expect(cacheManager.getState().totalSizeBytes).toBe(0);

      await cacheManager.shutdown();
    });
  });
});
