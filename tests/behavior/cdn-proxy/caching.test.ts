/**
 * Behavior tests for CDN Proxy caching (User Story 3).
 * Tests: T029-T033
 *
 * These tests verify the caching behavior.
 */

import { describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { handleArtifact } from "../../../src/cdn-proxy/handlers/artifact.js";
import { createRequestContext } from "../../../src/cdn-proxy/middleware.js";
import { parseRoute } from "../../../src/cdn-proxy/router.js";
import { createCache } from "../../../src/cdn-proxy/cache.js";
import type {
  S3Fetcher,
  FetchResult,
} from "../../../src/cdn-proxy/s3-fetcher.js";
import type { CdnProxyConfig } from "../../../src/cdn-proxy/types.js";

// Create a test server with custom handlers
function createTestServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, url: `http://localhost:${port}` });
    });
  });
}

// Make HTTP request helper
async function makeRequest(
  url: string,
  path: string,
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    http.get(`${url}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
      res.on("error", reject);
    });
  });
}

// Create default config with caching enabled
function createCachingConfig(): CdnProxyConfig {
  return {
    port: 8101,
    cacheEnabled: true,
    cacheMaxSizeBytes: 256 * 1024 * 1024, // 256MB
    cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
    cacheThresholdBytes: 1024 * 1024, // 1MB
    s3: {
      configured: true,
      endpoint: "http://localhost:9000",
      bucket: "test-bucket",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      region: "us-east-1",
    },
  };
}

describe("CDN Proxy - Caching", () => {
  const testUuid = "12345678-1234-1234-1234-123456789012";
  const testSvg = Buffer.from("<svg>test content</svg>");

  describe("T029: First request returns X-Cache: MISS, second returns X-Cache: HIT", () => {
    it("caches artifact on first request and returns from cache on second", async () => {
      let fetchCount = 0;
      const s3Fetcher: S3Fetcher = {
        async fetch(_key: string): Promise<FetchResult> {
          fetchCount++;
          return {
            content: testSvg,
            contentType: "image/svg+xml",
            contentLength: testSvg.length,
            etag: '"test-etag"',
          };
        },
        async healthCheck(): Promise<boolean> {
          return true;
        },
      };

      const config = createCachingConfig();
      const cache = createCache({
        maxSizeBytes: config.cacheMaxSizeBytes,
        ttlMs: config.cacheTtlMs,
        thresholdBytes: config.cacheThresholdBytes,
      });

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache,
          });
        }
      });

      try {
        // First request - should be a cache miss
        const response1 = await makeRequest(url, `/artifacts/${testUuid}.svg`);
        expect(response1.status).toBe(200);
        expect(response1.headers["x-cache"]).toBe("MISS");
        expect(fetchCount).toBe(1);

        // Second request - should be a cache hit
        const response2 = await makeRequest(url, `/artifacts/${testUuid}.svg`);
        expect(response2.status).toBe(200);
        expect(response2.headers["x-cache"]).toBe("HIT");
        expect(fetchCount).toBe(1); // No additional S3 fetch

        // Content should be the same
        expect(response1.body.toString()).toBe(response2.body.toString());
      } finally {
        server.close();
      }
    });
  });

  describe("T030: LRU eviction when cache exceeds max size", () => {
    it("evicts least recently used entries when cache is full", async () => {
      const smallContent = Buffer.alloc(100, "a"); // 100 bytes each

      // Create a small cache that can only hold 2 items
      const cache = createCache({
        maxSizeBytes: 250, // Can hold ~2 items of 100 bytes each
        ttlMs: 60000,
        thresholdBytes: 1000,
      });

      // Add 3 items, the first should be evicted
      cache.set("item1.svg", {
        content: smallContent,
        contentType: "image/svg+xml",
        sizeBytes: 100,
        cachedAt: Date.now(),
        s3Metadata: {},
      });

      cache.set("item2.svg", {
        content: smallContent,
        contentType: "image/svg+xml",
        sizeBytes: 100,
        cachedAt: Date.now(),
        s3Metadata: {},
      });

      // Access item1 to make item2 the LRU
      cache.get("item1.svg");

      cache.set("item3.svg", {
        content: smallContent,
        contentType: "image/svg+xml",
        sizeBytes: 100,
        cachedAt: Date.now(),
        s3Metadata: {},
      });

      // item2 should be evicted (LRU)
      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe("T031: TTL expiration causes cache miss", () => {
    it("expires entries after TTL", async () => {
      // Create cache with very short TTL
      const cache = createCache({
        maxSizeBytes: 1024 * 1024,
        ttlMs: 10, // 10ms TTL for testing
        thresholdBytes: 1024 * 1024,
      });

      cache.set("test.svg", {
        content: testSvg,
        contentType: "image/svg+xml",
        sizeBytes: testSvg.length,
        cachedAt: Date.now(),
        s3Metadata: {},
      });

      // Should be in cache initially
      expect(cache.get("test.svg")).toBeDefined();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should be expired now
      expect(cache.get("test.svg")).toBeUndefined();
    });
  });

  describe("T032: Large artifacts bypass cache (X-Cache: BYPASS)", () => {
    it("does not cache artifacts larger than threshold", async () => {
      const largeContent = Buffer.alloc(2 * 1024 * 1024, "x"); // 2MB

      const s3Fetcher: S3Fetcher = {
        async fetch(_key: string): Promise<FetchResult> {
          return {
            content: largeContent,
            contentType: "image/svg+xml",
            contentLength: largeContent.length,
          };
        },
        async healthCheck(): Promise<boolean> {
          return true;
        },
      };

      const config = createCachingConfig();
      config.cacheThresholdBytes = 1024 * 1024; // 1MB threshold

      const cache = createCache({
        maxSizeBytes: config.cacheMaxSizeBytes,
        ttlMs: config.cacheTtlMs,
        thresholdBytes: config.cacheThresholdBytes,
      });

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache,
          });
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${testUuid}.svg`);

        expect(response.status).toBe(200);
        expect(response.headers["x-cache"]).toBe("BYPASS");

        // Cache should have no entries
        const stats = cache.getStats();
        expect(stats.entryCount).toBe(0);
      } finally {
        server.close();
      }
    });
  });

  describe("T033: Concurrent requests for same artifact make only one S3 call", () => {
    it("coalesces concurrent requests to prevent thundering herd", async () => {
      let fetchCount = 0;
      let resolveFetch: (() => void) | null = null;

      // S3 fetcher with controlled timing
      const s3Fetcher: S3Fetcher = {
        async fetch(_key: string): Promise<FetchResult> {
          fetchCount++;
          // Wait for external trigger
          await new Promise<void>((resolve) => {
            resolveFetch = resolve;
          });
          return {
            content: testSvg,
            contentType: "image/svg+xml",
            contentLength: testSvg.length,
          };
        },
        async healthCheck(): Promise<boolean> {
          return true;
        },
      };

      const config = createCachingConfig();
      const cache = createCache({
        maxSizeBytes: config.cacheMaxSizeBytes,
        ttlMs: config.cacheTtlMs,
        thresholdBytes: config.cacheThresholdBytes,
      });

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache,
          });
        }
      });

      try {
        // Start 3 concurrent requests
        const request1 = makeRequest(url, `/artifacts/${testUuid}.svg`);
        const request2 = makeRequest(url, `/artifacts/${testUuid}.svg`);
        const request3 = makeRequest(url, `/artifacts/${testUuid}.svg`);

        // Wait a bit for requests to start
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Only one S3 fetch should be in progress
        expect(fetchCount).toBe(1);

        // Resolve the S3 fetch
        if (resolveFetch) {
          resolveFetch();
        }

        // Wait for all requests to complete
        const [response1, response2, response3] = await Promise.all([
          request1,
          request2,
          request3,
        ]);

        // All requests should succeed
        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(response3.status).toBe(200);

        // Only one S3 fetch should have occurred
        expect(fetchCount).toBe(1);

        // Content should be the same for all
        expect(response1.body.toString()).toBe(response2.body.toString());
        expect(response2.body.toString()).toBe(response3.body.toString());
      } finally {
        server.close();
      }
    });
  });

  describe("Cache unit tests", () => {
    it("shouldCache returns true for small artifacts", () => {
      const cache = createCache({
        maxSizeBytes: 1024 * 1024,
        ttlMs: 60000,
        thresholdBytes: 500,
      });

      expect(cache.shouldCache(100)).toBe(true);
      expect(cache.shouldCache(500)).toBe(true);
      expect(cache.shouldCache(501)).toBe(false);
    });

    it("tracks hit rate correctly", () => {
      const cache = createCache({
        maxSizeBytes: 1024 * 1024,
        ttlMs: 60000,
        thresholdBytes: 1024,
      });

      cache.set("test.svg", {
        content: testSvg,
        contentType: "image/svg+xml",
        sizeBytes: testSvg.length,
        cachedAt: Date.now(),
        s3Metadata: {},
      });

      // First get - hit
      cache.get("test.svg");
      // Second get - hit
      cache.get("test.svg");
      // Third get - miss (different key)
      cache.get("other.svg");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });
  });
});
