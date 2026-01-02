/**
 * Behavior tests for graceful degradation to inline mode.
 * Per TDD methodology: tests written first, must fail before implementation.
 * T051, T052, T053: Inline fallback when cache unavailable.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { CacheManager } from "../../../src/cache/index.js";
import { mermaidToSvgWithFallback } from "../../../src/tools/mermaid-to-svg.js";
import type { CacheConfig } from "../../../src/cache/types.js";
import type { MermaidToSvgInput } from "../../../src/schemas/mermaid-to-svg.js";

describe("Graceful Degradation - SVG", () => {
  let testRoot: string;
  let config: CacheConfig;
  let cacheManager: CacheManager;

  const validInput: MermaidToSvgInput = {
    code: "graph TD\n  A --> B",
  };

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

  describe("T051: Inline fallback when sessionId undefined", () => {
    it("should return inline SVG when sessionId is undefined", async () => {
      const result = await mermaidToSvgWithFallback(
        validInput,
        undefined, // No session ID
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be inline mode, not cached
        expect(result.mode).toBe("inline");
        // Should have SVG content directly
        expect(result.svg).toBeDefined();
        expect(result.svg).toContain("<svg");
        // Should NOT have artifact reference
        expect(result).not.toHaveProperty("artifact");
      }
    });
  });

  describe("T052: Inline fallback when cache disabled", () => {
    it("should return inline SVG when cache is disabled", async () => {
      // Create cache with disabled flag
      const disabledConfig: CacheConfig = {
        ...config,
        enabled: false,
      };
      const disabledCache = await CacheManager.create(disabledConfig);

      const sessionId = randomUUID();

      try {
        const result = await mermaidToSvgWithFallback(
          validInput,
          sessionId,
          disabledCache,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.mode).toBe("inline");
          expect(result.svg).toContain("<svg");
          expect(result).not.toHaveProperty("artifact");
        }
      } finally {
        await disabledCache.shutdown();
      }
    });
  });

  describe("T053: CACHE_UNAVAILABLE warning in fallback", () => {
    it("should include CACHE_UNAVAILABLE warning when falling back", async () => {
      const result = await mermaidToSvgWithFallback(
        validInput,
        undefined, // No session - forces fallback
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mode).toBe("inline");
        // Should have a warning about cache being unavailable
        expect(result.warnings).toBeDefined();
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe("CACHE_UNAVAILABLE");
        expect(result.warnings[0].message).toBeDefined();
      }
    });

    it("should include CACHE_UNAVAILABLE warning when cache disabled", async () => {
      const disabledConfig: CacheConfig = {
        ...config,
        enabled: false,
      };
      const disabledCache = await CacheManager.create(disabledConfig);
      const sessionId = randomUUID();

      try {
        const result = await mermaidToSvgWithFallback(
          validInput,
          sessionId,
          disabledCache,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.mode).toBe("inline");
          expect(result.warnings.length).toBeGreaterThan(0);
          expect(result.warnings[0].code).toBe("CACHE_UNAVAILABLE");
        }
      } finally {
        await disabledCache.shutdown();
      }
    });
  });

  describe("Normal cached operation", () => {
    it("should use cached mode when session and cache are available", async () => {
      const sessionId = randomUUID();

      const result = await mermaidToSvgWithFallback(
        validInput,
        sessionId,
        cacheManager,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mode).toBe("cached");
        expect(result.artifact).toBeDefined();
        expect(result).not.toHaveProperty("svg");
      }
    });
  });
});
