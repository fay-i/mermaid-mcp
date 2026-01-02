/**
 * Error tests for fetch_artifact tool.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T026, T027: Error tests for ARTIFACT_NOT_FOUND and INVALID_ARTIFACT_ID.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import type { CacheConfig } from "../../../src/cache/types.js";
import { fetchArtifact } from "../../../src/tools/fetch-artifact.js";

describe("fetch_artifact error tests", () => {
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

  describe("T026: ARTIFACT_NOT_FOUND error", () => {
    it("should return ARTIFACT_NOT_FOUND for non-existent artifact", async () => {
      const sessionId = randomUUID();
      const nonExistentId = randomUUID();

      const result = await fetchArtifact(
        { artifact_id: nonExistentId },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("ARTIFACT_NOT_FOUND");
        expect(result.errors[0].message).toContain(nonExistentId);
      }
    });
  });

  describe("T027: INVALID_ARTIFACT_ID error", () => {
    it("should return INVALID_ARTIFACT_ID for malformed UUID", async () => {
      const sessionId = randomUUID();

      const result = await fetchArtifact(
        { artifact_id: "not-a-uuid" },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_ARTIFACT_ID");
      }
    });

    it("should return INVALID_ARTIFACT_ID for empty string", async () => {
      const sessionId = randomUUID();

      const result = await fetchArtifact(
        { artifact_id: "" },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_ARTIFACT_ID");
      }
    });
  });
});
