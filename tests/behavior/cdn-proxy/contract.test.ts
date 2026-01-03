/**
 * Contract tests for CDN Proxy API.
 * Validates responses match OpenAPI specification (cdn-proxy-api.yaml).
 *
 * These tests ensure API responses conform to the documented contract,
 * preventing drift between specification and implementation.
 */

import { describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { handleHealth } from "../../../src/cdn-proxy/handlers/health.js";
import { handleArtifact } from "../../../src/cdn-proxy/handlers/artifact.js";
import { createRequestContext } from "../../../src/cdn-proxy/middleware.js";
import { parseRoute } from "../../../src/cdn-proxy/router.js";
import { sendError } from "../../../src/cdn-proxy/errors.js";
import type {
  S3Fetcher,
  FetchResult,
} from "../../../src/cdn-proxy/s3-fetcher.js";
import type { ArtifactCache } from "../../../src/cdn-proxy/cache.js";
import type {
  CacheStats,
  CdnProxyConfig,
  CdnErrorCode,
} from "../../../src/cdn-proxy/types.js";

// UUID pattern per OpenAPI spec
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 timestamp pattern
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

// Valid error codes per OpenAPI spec
const VALID_ERROR_CODES: CdnErrorCode[] = [
  "ARTIFACT_NOT_FOUND",
  "INVALID_PATH",
  "S3_ERROR",
  "NOT_CONFIGURED",
  "INTERNAL_ERROR",
];

// Valid X-Cache values per OpenAPI spec
const VALID_CACHE_HEADERS = ["HIT", "MISS", "BYPASS", "DISABLED"];

// Create test server helper
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

// HTTP request helper
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

// Mock S3 fetcher
function createMockS3Fetcher(
  healthy: boolean,
  artifacts?: Map<string, FetchResult>,
): S3Fetcher {
  return {
    async fetch(key: string): Promise<FetchResult> {
      if (artifacts) {
        const result = artifacts.get(key);
        if (result) return result;
      }
      const error = new Error("Not found");
      (error as Error & { name: string }).name = "NoSuchKey";
      throw error;
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

// Test config
function createTestConfig(): CdnProxyConfig {
  return {
    port: 8101,
    cacheEnabled: false,
    cacheMaxSizeBytes: 256 * 1024 * 1024,
    cacheTtlMs: 24 * 60 * 60 * 1000,
    cacheThresholdBytes: 1024 * 1024,
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

describe("CDN Proxy - OpenAPI Contract Validation", () => {
  describe("HealthStatus Schema Contract", () => {
    it("healthy response contains all required fields per OpenAPI spec", async () => {
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
        const body = JSON.parse(response.body.toString());

        // Required fields per OpenAPI HealthStatus schema
        expect(body).toHaveProperty("ok");
        expect(body).toHaveProperty("service");
        expect(body).toHaveProperty("s3_connected");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("uptime_seconds");

        // Type validation
        expect(typeof body.ok).toBe("boolean");
        expect(body.service).toBe("cdn-proxy"); // const value per spec
        expect(typeof body.s3_connected).toBe("boolean");
        expect(typeof body.uptime_seconds).toBe("number");
        expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);

        // Timestamp format validation (ISO 8601)
        expect(body.timestamp).toMatch(ISO_8601_PATTERN);
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
      } finally {
        server.close();
      }
    });

    it("unhealthy response (503) contains all required fields", async () => {
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
        const body = JSON.parse(response.body.toString());

        // Status code per OpenAPI spec
        expect(response.status).toBe(503);

        // Required fields still present
        expect(body).toHaveProperty("ok");
        expect(body).toHaveProperty("service");
        expect(body).toHaveProperty("s3_connected");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("uptime_seconds");

        // Values for unhealthy state
        expect(body.ok).toBe(false);
        expect(body.s3_connected).toBe(false);
      } finally {
        server.close();
      }
    });

    it("cache stats contain all required fields when cache enabled", async () => {
      const s3Fetcher = createMockS3Fetcher(true);
      const getUptimeSeconds = () => 60;
      const cacheStats: CacheStats = {
        hits: 100,
        misses: 50,
        evictions: 10,
        sizeBytes: 1024 * 1024 * 50,
        maxSizeBytes: 1024 * 1024 * 256,
        entryCount: 25,
        hitRate: 0.667,
      };
      const cache = createMockCache(cacheStats);

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);
        if (route.type === "health") {
          await handleHealth(res, ctx, { s3Fetcher, cache, getUptimeSeconds });
        }
      });

      try {
        const response = await makeRequest(url, "/health");
        const body = JSON.parse(response.body.toString());

        // CacheStats required fields per OpenAPI spec
        expect(body.cache).toHaveProperty("hits");
        expect(body.cache).toHaveProperty("misses");
        expect(body.cache).toHaveProperty("evictions");
        expect(body.cache).toHaveProperty("hit_rate");
        expect(body.cache).toHaveProperty("size_bytes");
        expect(body.cache).toHaveProperty("max_size_bytes");
        expect(body.cache).toHaveProperty("entry_count");

        // Type validation
        expect(typeof body.cache.hits).toBe("number");
        expect(typeof body.cache.misses).toBe("number");
        expect(typeof body.cache.evictions).toBe("number");
        expect(typeof body.cache.hit_rate).toBe("number");
        expect(typeof body.cache.size_bytes).toBe("number");
        expect(typeof body.cache.max_size_bytes).toBe("number");
        expect(typeof body.cache.entry_count).toBe("number");

        // Range validation per OpenAPI spec
        expect(body.cache.hits).toBeGreaterThanOrEqual(0);
        expect(body.cache.misses).toBeGreaterThanOrEqual(0);
        expect(body.cache.evictions).toBeGreaterThanOrEqual(0);
        expect(body.cache.hit_rate).toBeGreaterThanOrEqual(0);
        expect(body.cache.hit_rate).toBeLessThanOrEqual(1);
        expect(body.cache.size_bytes).toBeGreaterThanOrEqual(0);
        expect(body.cache.max_size_bytes).toBeGreaterThanOrEqual(0);
        expect(body.cache.entry_count).toBeGreaterThanOrEqual(0);
      } finally {
        server.close();
      }
    });
  });

  describe("ErrorResponse Schema Contract", () => {
    const errorCases: Array<{ code: CdnErrorCode; expectedStatus: number }> = [
      { code: "INVALID_PATH", expectedStatus: 400 },
      { code: "ARTIFACT_NOT_FOUND", expectedStatus: 404 },
      { code: "INTERNAL_ERROR", expectedStatus: 500 },
      { code: "S3_ERROR", expectedStatus: 502 },
      { code: "NOT_CONFIGURED", expectedStatus: 503 },
    ];

    for (const { code, expectedStatus } of errorCases) {
      it(`${code} error response contains all required fields per OpenAPI spec`, async () => {
        const testPath = "/artifacts/test.svg";

        const { server, url } = await createTestServer(async (req, res) => {
          const ctx = createRequestContext(req);
          sendError(res, code, ctx.path, ctx.requestId);
        });

        try {
          const response = await makeRequest(url, testPath);
          const body = JSON.parse(response.body.toString());

          // Status code mapping
          expect(response.status).toBe(expectedStatus);

          // Required fields per OpenAPI ErrorResponse schema
          expect(body).toHaveProperty("error");
          expect(body).toHaveProperty("message");
          expect(body).toHaveProperty("path");
          expect(body).toHaveProperty("request_id");
          expect(body).toHaveProperty("timestamp");

          // Type validation
          expect(typeof body.error).toBe("string");
          expect(typeof body.message).toBe("string");
          expect(typeof body.path).toBe("string");
          expect(typeof body.request_id).toBe("string");
          expect(typeof body.timestamp).toBe("string");

          // Error code is valid enum value
          expect(VALID_ERROR_CODES).toContain(body.error);
          expect(body.error).toBe(code);

          // request_id is UUID format
          expect(body.request_id).toMatch(UUID_PATTERN);

          // timestamp is ISO 8601
          expect(body.timestamp).toMatch(ISO_8601_PATTERN);

          // path matches request
          expect(body.path).toBe(testPath);
        } finally {
          server.close();
        }
      });
    }

    it("error responses include X-Request-Id header", async () => {
      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        sendError(res, "INVALID_PATH", ctx.path, ctx.requestId);
      });

      try {
        const response = await makeRequest(url, "/artifacts/invalid");

        expect(response.headers["x-request-id"]).toBeDefined();
        expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);
      } finally {
        server.close();
      }
    });

    it("error responses have Content-Type application/json", async () => {
      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        sendError(res, "INVALID_PATH", ctx.path, ctx.requestId);
      });

      try {
        const response = await makeRequest(url, "/artifacts/invalid");

        expect(response.headers["content-type"]).toBe("application/json");
      } finally {
        server.close();
      }
    });
  });

  describe("Artifact Response Headers Contract", () => {
    const testUuid = "12345678-1234-1234-1234-123456789012";
    const testSvg = Buffer.from("<svg>test</svg>");

    it("SVG response has required headers per OpenAPI spec", async () => {
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.svg`, {
        content: testSvg,
        contentType: "image/svg+xml",
        contentLength: testSvg.length,
        etag: '"abc123"',
      });

      const s3Fetcher = createMockS3Fetcher(true, artifacts);
      const config = createTestConfig();

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);
        if (route.type === "artifact") {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache: null,
          });
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${testUuid}.svg`);

        // Content-Type per OpenAPI spec (const: image/svg+xml)
        expect(response.headers["content-type"]).toBe("image/svg+xml");

        // X-Artifact-Id header (UUID format)
        expect(response.headers["x-artifact-id"]).toBe(testUuid);

        // X-Request-Id header (UUID format)
        expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);

        // X-Cache header (enum: HIT, MISS, BYPASS)
        expect(VALID_CACHE_HEADERS).toContain(response.headers["x-cache"]);

        // Cache-Control header
        expect(response.headers["cache-control"]).toBeDefined();
        expect(response.headers["cache-control"]).toContain("max-age=");

        // Content-Length header
        expect(response.headers["content-length"]).toBe(String(testSvg.length));

        // ETag header (when provided by S3)
        expect(response.headers.etag).toBe('"abc123"');
      } finally {
        server.close();
      }
    });

    it("PDF response has Content-Type application/pdf per OpenAPI spec", async () => {
      const testPdf = Buffer.from("%PDF-1.4 test");
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.pdf`, {
        content: testPdf,
        contentType: "application/pdf",
        contentLength: testPdf.length,
        etag: '"pdf123"',
      });

      const s3Fetcher = createMockS3Fetcher(true, artifacts);
      const config = createTestConfig();

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);
        if (route.type === "artifact") {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache: null,
          });
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${testUuid}.pdf`);

        // Content-Type per OpenAPI spec (const: application/pdf)
        expect(response.headers["content-type"]).toBe("application/pdf");
      } finally {
        server.close();
      }
    });
  });

  describe("Artifact ID Format Contract", () => {
    it("valid UUID artifact IDs are accepted", async () => {
      const validUuids = [
        "12345678-1234-1234-1234-123456789012",
        "abcdef01-2345-6789-abcd-ef0123456789",
        "00000000-0000-0000-0000-000000000000",
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
      ];

      for (const uuid of validUuids) {
        const route = parseRoute(`/artifacts/${uuid}.svg`);
        expect(route.type).toBe("artifact");
        if (route.type === "artifact") {
          expect(route.artifact.artifactId).toBe(uuid);
        }
      }
    });

    it("invalid artifact IDs return INVALID_PATH (400)", async () => {
      const invalidPaths = [
        "/artifacts/invalid.svg",
        "/artifacts/12345.svg",
        "/artifacts/not-a-uuid-format.svg",
        "/artifacts/12345678-1234-1234-1234.svg", // truncated UUID
        "/artifacts/.svg",
      ];

      for (const path of invalidPaths) {
        const route = parseRoute(path);
        expect(route.type).toBe("invalid_path");
      }
    });

    it("unsupported extensions return INVALID_PATH (400)", async () => {
      const testUuid = "12345678-1234-1234-1234-123456789012";
      const unsupportedExtensions = [".png", ".jpg", ".gif", ".webp", ".txt"];

      for (const ext of unsupportedExtensions) {
        const route = parseRoute(`/artifacts/${testUuid}${ext}`);
        expect(route.type).toBe("invalid_path");
      }
    });
  });
});
