/**
 * Behavior tests for session cleanup.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T037, T038, T039: Cleanup on timeout, directory deletion, shutdown cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import { fileExists } from "../../../src/cache/storage.js";
import type { CacheConfig } from "../../../src/cache/types.js";

describe("Session Cleanup", () => {
  let testRoot: string;
  let config: CacheConfig;

  beforeEach(async () => {
    testRoot = join(tmpdir(), `mermaid-mcp-test-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });

    config = {
      rootDirectory: testRoot,
      quotaBytes: 1024 * 1024 * 1024,
      enabled: true,
      sessionTimeoutMs: 100, // Short timeout for testing
      cleanupIntervalMs: 0, // Disable periodic cleanup for tests
    };
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  describe("T037: Cleanup on session timeout", () => {
    it("should clean up session after inactivity timeout", async () => {
      // Enable periodic cleanup for this test
      const cleanupConfig = { ...config, cleanupIntervalMs: 50 };
      const cacheManager = await CacheManager.create(cleanupConfig);

      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");
      const ref = await cacheManager.writeArtifact(
        sessionId,
        content,
        "image/svg+xml",
      );
      const filePath = ref.uri.replace("file://", "");

      // File should exist initially
      expect(await fileExists(filePath)).toBe(true);

      // Wait for timeout + cleanup interval
      await new Promise((resolve) => setTimeout(resolve, 200));

      // File should be cleaned up
      expect(await fileExists(filePath)).toBe(false);

      await cacheManager.shutdown();
    });
  });

  describe("T038: Session directory deletion", () => {
    it("should delete entire session directory on cleanup", async () => {
      const cacheManager = await CacheManager.create(config);
      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      // Create multiple artifacts in session
      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");
      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");

      const sessionDir = join(testRoot, sessionId);
      expect(await fileExists(sessionDir)).toBe(true);

      // Cleanup session
      await cacheManager.cleanupSession(sessionId);

      // Session directory should be gone
      expect(await fileExists(sessionDir)).toBe(false);

      await cacheManager.shutdown();
    });

    it("should not affect other sessions when cleaning up one session", async () => {
      const cacheManager = await CacheManager.create(config);
      const session1 = randomUUID();
      const session2 = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      const ref1 = await cacheManager.writeArtifact(
        session1,
        content,
        "image/svg+xml",
      );
      const ref2 = await cacheManager.writeArtifact(
        session2,
        content,
        "image/svg+xml",
      );

      const file1 = ref1.uri.replace("file://", "");
      const file2 = ref2.uri.replace("file://", "");

      // Cleanup session1
      await cacheManager.cleanupSession(session1);

      // Session1 files should be gone
      expect(await fileExists(file1)).toBe(false);

      // Session2 files should still exist
      expect(await fileExists(file2)).toBe(true);

      await cacheManager.shutdown();
    });
  });

  describe("T039: Cleanup on server shutdown", () => {
    it("should clean up all sessions on shutdown", async () => {
      const cacheManager = await CacheManager.create(config);
      const session1 = randomUUID();
      const session2 = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      const ref1 = await cacheManager.writeArtifact(
        session1,
        content,
        "image/svg+xml",
      );
      const ref2 = await cacheManager.writeArtifact(
        session2,
        content,
        "image/svg+xml",
      );

      const file1 = ref1.uri.replace("file://", "");
      const file2 = ref2.uri.replace("file://", "");

      // Files should exist
      expect(await fileExists(file1)).toBe(true);
      expect(await fileExists(file2)).toBe(true);

      // Shutdown
      await cacheManager.shutdown();

      // All files should be cleaned up
      expect(await fileExists(file1)).toBe(false);
      expect(await fileExists(file2)).toBe(false);
    });

    it("should update cache state after cleanup", async () => {
      const cacheManager = await CacheManager.create(config);
      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      await cacheManager.writeArtifact(sessionId, content, "image/svg+xml");

      const stateBefore = cacheManager.getState();
      expect(stateBefore.sessionCount).toBe(1);
      expect(stateBefore.artifactCount).toBe(1);
      expect(stateBefore.totalSizeBytes).toBeGreaterThan(0);

      await cacheManager.cleanupSession(sessionId);

      const stateAfter = cacheManager.getState();
      expect(stateAfter.sessionCount).toBe(0);
      expect(stateAfter.artifactCount).toBe(0);
      expect(stateAfter.totalSizeBytes).toBe(0);

      await cacheManager.shutdown();
    });
  });
});
