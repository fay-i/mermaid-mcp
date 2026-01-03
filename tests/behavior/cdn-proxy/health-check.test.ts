/**
 * Behavior tests for CDN Proxy health check (User Story 2).
 * Tests: T022-T024
 *
 * These tests verify the health endpoint behavior.
 */

import { describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { handleHealth } from "../../../src/cdn-proxy/handlers/health.js";
import { createRequestContext } from "../../../src/cdn-proxy/middleware.js";
import { parseRoute } from "../../../src/cdn-proxy/router.js";
import type { S3Fetcher } from "../../../src/cdn-proxy/s3-fetcher.js";
import type { ArtifactCache } from "../../../src/cdn-proxy/cache.js";
import type { CacheStats } from "../../../src/cdn-proxy/types.js";

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
  body: string;
}> {
  return new Promise((resolve, reject) => {
    http.get(`${url}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        });
      });
      res.on("error", reject);
    });
  });
}

// Mock S3 fetcher
function createMockS3Fetcher(healthy: boolean): S3Fetcher {
  return {
    async fetch(_key: string) {
      throw new Error("Not implemented");
    },
    async healthCheck(): Promise<boolean> {
      return healthy;
    },
  };
}

// Mock cache
function createMockCache(stats: CacheStats): ArtifactCache {
  return {
    get: () => undefined,
    set: () => true,
    shouldCache: () => true,
    getStats: () => stats,
    hasInFlight: () => false,
    getInFlight: () => undefined,
    setInFlight: () => {},
    removeInFlight: () => {},
  };
}

describe("CDN Proxy - Health Check", () => {
  describe("T022: GET /health returns 200 with HealthStatus schema when S3 reachable", () => {
    it("returns ok=true and s3_connected=true when S3 is healthy", async () => {
      const s3Fetcher = createMockS3Fetcher(true);
      const getUptimeSeconds = () => 42;

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "health") {
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache: null,
            getUptimeSeconds,
          });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body);

        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.service).toBe("cdn-proxy");
        expect(body.s3_connected).toBe(true);
      } finally {
        server.close();
      }
    });
  });

  describe("T023: GET /health returns s3_connected=false when S3 unreachable", () => {
    it("returns s3_connected=false and 503 status when S3 is unhealthy", async () => {
      const s3Fetcher = createMockS3Fetcher(false);
      const getUptimeSeconds = () => 100;

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "health") {
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache: null,
            getUptimeSeconds,
          });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body);

        expect(response.status).toBe(503);
        expect(body.ok).toBe(false);
        expect(body.s3_connected).toBe(false);
        expect(body.service).toBe("cdn-proxy");
      } finally {
        server.close();
      }
    });
  });

  describe("T024: Health response includes uptime_seconds and timestamp", () => {
    it("includes uptime_seconds from uptime calculator", async () => {
      const s3Fetcher = createMockS3Fetcher(true);
      const expectedUptime = 12345;
      const getUptimeSeconds = () => expectedUptime;

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "health") {
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache: null,
            getUptimeSeconds,
          });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body);

        expect(body.uptime_seconds).toBe(expectedUptime);
      } finally {
        server.close();
      }
    });

    it("includes valid ISO 8601 timestamp", async () => {
      const s3Fetcher = createMockS3Fetcher(true);
      const getUptimeSeconds = () => 0;

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "health") {
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache: null,
            getUptimeSeconds,
          });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body);

        // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
        const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
        expect(body.timestamp).toMatch(isoPattern);

        // Verify it's a valid date
        const date = new Date(body.timestamp);
        expect(date.toISOString()).toBe(body.timestamp);
      } finally {
        server.close();
      }
    });

    it("includes cache stats when cache is enabled", async () => {
      const s3Fetcher = createMockS3Fetcher(true);
      const getUptimeSeconds = () => 60;
      const cacheStats: CacheStats = {
        hits: 100,
        misses: 50,
        evictions: 10,
        sizeBytes: 1024 * 1024 * 50, // 50MB
        maxSizeBytes: 1024 * 1024 * 256, // 256MB
        entryCount: 25,
        hitRate: 0.667,
      };
      const cache = createMockCache(cacheStats);

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "health") {
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache,
            getUptimeSeconds,
          });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body);

        expect(body.cache).toBeDefined();
        expect(body.cache.hits).toBe(100);
        expect(body.cache.misses).toBe(50);
        expect(body.cache.evictions).toBe(10);
        expect(body.cache.size_bytes).toBe(1024 * 1024 * 50);
        expect(body.cache.max_size_bytes).toBe(1024 * 1024 * 256);
        expect(body.cache.entry_count).toBe(25);
        expect(body.cache.hit_rate).toBeCloseTo(0.667, 2);
      } finally {
        server.close();
      }
    });

    it("omits cache stats when cache is not enabled", async () => {
      const s3Fetcher = createMockS3Fetcher(true);
      const getUptimeSeconds = () => 60;

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "health") {
          await handleHealth(res, ctx, {
            s3Fetcher,
            cache: null,
            getUptimeSeconds,
          });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body);

        expect(body.cache).toBeUndefined();
      } finally {
        server.close();
      }
    });
  });
});
