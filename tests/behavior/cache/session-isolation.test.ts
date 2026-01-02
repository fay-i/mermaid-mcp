/**
 * Behavior tests for session isolation.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T033, T034: Session-scoped storage and cross-session access denial.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import type { CacheConfig } from "../../../src/cache/types.js";

describe("Session Isolation", () => {
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

  describe("T033: Session-scoped artifact storage", () => {
    it("should store artifact in session-specific directory", async () => {
      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      const ref = await cacheManager.writeArtifact(
        sessionId,
        content,
        "image/svg+xml",
      );

      // URI should contain session ID
      expect(ref.uri).toContain(sessionId);
    });

    it("should isolate artifacts between sessions", async () => {
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

      // Different URIs
      expect(ref1.uri).not.toBe(ref2.uri);

      // Different artifact IDs
      expect(ref1.artifact_id).not.toBe(ref2.artifact_id);

      // Session1 can access its own artifact
      const result1 = await cacheManager.getArtifact(
        ref1.artifact_id,
        session1,
      );
      expect(result1.ok).toBe(true);

      // Session2 can access its own artifact
      const result2 = await cacheManager.getArtifact(
        ref2.artifact_id,
        session2,
      );
      expect(result2.ok).toBe(true);
    });
  });

  describe("T034: SESSION_MISMATCH error", () => {
    it("should return SESSION_MISMATCH when fetching from wrong session", async () => {
      const sessionA = randomUUID();
      const sessionB = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      // Create artifact in session A
      const ref = await cacheManager.writeArtifact(
        sessionA,
        content,
        "image/svg+xml",
      );

      // Try to fetch from session B
      const result = await cacheManager.getArtifact(ref.artifact_id, sessionB);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SESSION_MISMATCH");
        expect(result.error.message).toContain("different session");
        expect(result.error.details).toBeDefined();
        expect(result.error.details?.artifact_session).toBe(sessionA);
        expect(result.error.details?.request_session).toBe(sessionB);
      }
    });

    it("should allow same session to access its artifacts", async () => {
      const sessionId = randomUUID();
      const content = Buffer.from("<svg>test</svg>", "utf-8");

      const ref = await cacheManager.writeArtifact(
        sessionId,
        content,
        "image/svg+xml",
      );
      const result = await cacheManager.getArtifact(ref.artifact_id, sessionId);

      expect(result.ok).toBe(true);
    });
  });
});
