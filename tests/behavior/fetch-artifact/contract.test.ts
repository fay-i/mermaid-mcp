/**
 * Contract tests for fetch_artifact tool.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T023, T024, T025: Contract tests for success responses with encoding.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import type { CacheConfig } from "../../../src/cache/types.js";
import { fetchArtifact } from "../../../src/tools/fetch-artifact.js";

describe("fetch_artifact contract tests", () => {
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

  describe("T023: Success response contract", () => {
    it("should return success response with required fields", async () => {
      const sessionId = randomUUID();
      const svgContent = "<svg>test</svg>";
      const artifactRef = await cacheManager.writeArtifact(
        sessionId,
        Buffer.from(svgContent, "utf-8"),
        "image/svg+xml",
      );

      const result = await fetchArtifact(
        { artifact_id: artifactRef.artifact_id },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.content).toBeDefined();
        expect(result.content_type).toBe("image/svg+xml");
        expect(result.size_bytes).toBeGreaterThan(0);
        expect(result.encoding).toBeDefined();
      }
    });
  });

  describe("T024: Base64 encoding", () => {
    it("should return base64-encoded content when encoding=base64", async () => {
      const sessionId = randomUUID();
      const svgContent = "<svg>test</svg>";
      const artifactRef = await cacheManager.writeArtifact(
        sessionId,
        Buffer.from(svgContent, "utf-8"),
        "image/svg+xml",
      );

      const result = await fetchArtifact(
        { artifact_id: artifactRef.artifact_id, encoding: "base64" },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.encoding).toBe("base64");
        // Decode and verify content
        const decoded = Buffer.from(result.content, "base64").toString("utf-8");
        expect(decoded).toBe(svgContent);
      }
    });

    it("should default to base64 encoding when not specified", async () => {
      const sessionId = randomUUID();
      const svgContent = "<svg>test</svg>";
      const artifactRef = await cacheManager.writeArtifact(
        sessionId,
        Buffer.from(svgContent, "utf-8"),
        "image/svg+xml",
      );

      const result = await fetchArtifact(
        { artifact_id: artifactRef.artifact_id },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.encoding).toBe("base64");
      }
    });
  });

  describe("T025: UTF-8 encoding", () => {
    it("should return utf8-encoded content when encoding=utf8", async () => {
      const sessionId = randomUUID();
      const svgContent = "<svg>test content</svg>";
      const artifactRef = await cacheManager.writeArtifact(
        sessionId,
        Buffer.from(svgContent, "utf-8"),
        "image/svg+xml",
      );

      const result = await fetchArtifact(
        { artifact_id: artifactRef.artifact_id, encoding: "utf8" },
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.encoding).toBe("utf8");
        expect(result.content).toBe(svgContent);
      }
    });
  });
});
