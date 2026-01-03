/**
 * Behavior tests for CDN Proxy artifact retrieval (User Story 1).
 * Tests: T010-T014, T013a, T013b
 *
 * These tests verify the artifact retrieval HTTP API behavior.
 */

import { describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type {
  ArtifactRef,
  CdnProxyConfig,
} from "../../../src/cdn-proxy/types.js";
import {
  parseRoute,
  getContentType,
  artifactToS3Key,
} from "../../../src/cdn-proxy/router.js";
import { handleArtifact } from "../../../src/cdn-proxy/handlers/artifact.js";
import { createRequestContext } from "../../../src/cdn-proxy/middleware.js";
import { sendError } from "../../../src/cdn-proxy/errors.js";
import type {
  S3Fetcher,
  FetchResult,
} from "../../../src/cdn-proxy/s3-fetcher.js";

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

// Mock S3 fetcher that stores test artifacts
function createMockS3Fetcher(artifacts: Map<string, FetchResult>): S3Fetcher {
  return {
    async fetch(key: string): Promise<FetchResult> {
      const result = artifacts.get(key);
      if (!result) {
        const error = new Error(`Artifact not found: ${key}`);
        (error as Error & { name: string }).name = "NoSuchKey";
        throw error;
      }
      return result;
    },
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

// Mock S3 fetcher that throws errors
function createErrorS3Fetcher(errorType: "not_found" | "s3_error"): S3Fetcher {
  return {
    async fetch(_key: string): Promise<FetchResult> {
      if (errorType === "not_found") {
        const error = new Error("Artifact not found");
        (error as Error & { name: string }).name = "NoSuchKey";
        throw error;
      }
      throw new Error("S3 connection failed");
    },
    async healthCheck(): Promise<boolean> {
      return errorType !== "s3_error";
    },
  };
}

// Create default config
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

describe("CDN Proxy - Artifact Retrieval", () => {
  const testUuid = "12345678-1234-1234-1234-123456789012";
  const testSvg = Buffer.from("<svg>test</svg>");
  const testPdf = Buffer.from("%PDF-1.4 test");

  describe("T010: GET /artifacts/{artifactId}.svg returns 200 with Content-Type image/svg+xml", () => {
    it("returns SVG content with correct Content-Type", async () => {
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.svg`, {
        content: testSvg,
        contentType: "image/svg+xml",
        contentLength: testSvg.length,
        etag: '"abc123"',
      });

      const s3Fetcher = createMockS3Fetcher(artifacts);
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

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("image/svg+xml");
        expect(response.body.toString()).toBe("<svg>test</svg>");
      } finally {
        server.close();
      }
    });
  });

  describe("T011: GET /artifacts/{artifactId}.pdf returns 200 with Content-Type application/pdf", () => {
    it("returns PDF content with correct Content-Type", async () => {
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.pdf`, {
        content: testPdf,
        contentType: "application/pdf",
        contentLength: testPdf.length,
        etag: '"def456"',
      });

      const s3Fetcher = createMockS3Fetcher(artifacts);
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

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.body.toString()).toBe("%PDF-1.4 test");
      } finally {
        server.close();
      }
    });
  });

  describe("T012: GET /artifacts/{artifactId}.svg for non-existent artifact returns 404", () => {
    it("returns 404 ARTIFACT_NOT_FOUND for missing artifact", async () => {
      const s3Fetcher = createErrorS3Fetcher("not_found");
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
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(404);
        expect(body.error).toBe("ARTIFACT_NOT_FOUND");
        expect(body.message).toBe("Artifact does not exist");
        expect(body.path).toBe(`/artifacts/${testUuid}.svg`);
      } finally {
        server.close();
      }
    });
  });

  describe("T013: GET /artifacts/invalid-path returns 400 INVALID_PATH", () => {
    it("returns 400 for invalid artifact ID format", async () => {
      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "invalid_path") {
          sendError(res, "INVALID_PATH", ctx.path, ctx.requestId);
        }
      });

      try {
        const response = await makeRequest(url, "/artifacts/invalid.svg");
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(400);
        expect(body.error).toBe("INVALID_PATH");
      } finally {
        server.close();
      }
    });

    it("returns 400 for missing extension", async () => {
      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "invalid_path") {
          sendError(res, "INVALID_PATH", ctx.path, ctx.requestId);
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${testUuid}`);
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(400);
        expect(body.error).toBe("INVALID_PATH");
      } finally {
        server.close();
      }
    });

    it("returns 400 for unsupported extension", async () => {
      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "invalid_path") {
          sendError(res, "INVALID_PATH", ctx.path, ctx.requestId);
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${testUuid}.png`);
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(400);
        expect(body.error).toBe("INVALID_PATH");
      } finally {
        server.close();
      }
    });
  });

  describe("T013a: GET artifact when S3 not configured returns 503 NOT_CONFIGURED", () => {
    it("returns 503 when S3 is not configured", async () => {
      const config: CdnProxyConfig = {
        ...createTestConfig(),
        s3: { configured: false },
      };

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher: null, // No S3 fetcher when not configured
            cache: null,
          });
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${testUuid}.svg`);
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(503);
        expect(body.error).toBe("NOT_CONFIGURED");
        expect(body.message).toBe("S3 storage is not configured");
      } finally {
        server.close();
      }
    });
  });

  describe("T013b: GET artifact when S3 returns error returns 502 S3_ERROR", () => {
    it("returns 502 for S3 transient errors", async () => {
      const s3Fetcher = createErrorS3Fetcher("s3_error");
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
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(502);
        expect(body.error).toBe("S3_ERROR");
        expect(body.message).toBe("Failed to retrieve artifact from storage");
      } finally {
        server.close();
      }
    });
  });

  describe("T014: Response includes required headers", () => {
    it("includes X-Artifact-Id, X-Request-Id, Cache-Control, and Content-Length", async () => {
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.svg`, {
        content: testSvg,
        contentType: "image/svg+xml",
        contentLength: testSvg.length,
        etag: '"abc123"',
      });

      const s3Fetcher = createMockS3Fetcher(artifacts);
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

        expect(response.status).toBe(200);
        expect(response.headers["x-artifact-id"]).toBe(testUuid);
        expect(response.headers["x-request-id"]).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(response.headers["cache-control"]).toBe("public, max-age=86400");
        expect(response.headers["content-length"]).toBe(String(testSvg.length));
      } finally {
        server.close();
      }
    });

    it("includes ETag when available from S3", async () => {
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.svg`, {
        content: testSvg,
        contentType: "image/svg+xml",
        contentLength: testSvg.length,
        etag: '"test-etag-123"',
      });

      const s3Fetcher = createMockS3Fetcher(artifacts);
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

        expect(response.headers.etag).toBe('"test-etag-123"');
      } finally {
        server.close();
      }
    });

    it("includes X-Cache header with MISS when not cached", async () => {
      const artifacts = new Map<string, FetchResult>();
      artifacts.set(`${testUuid}.svg`, {
        content: testSvg,
        contentType: "image/svg+xml",
        contentLength: testSvg.length,
      });

      const s3Fetcher = createMockS3Fetcher(artifacts);
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

        expect(response.headers["x-cache"]).toBe("DISABLED");
      } finally {
        server.close();
      }
    });
  });
});

describe("CDN Proxy - Router", () => {
  describe("parseRoute", () => {
    it("parses valid artifact paths correctly", () => {
      const result = parseRoute(
        "/artifacts/12345678-1234-1234-1234-123456789012.svg",
      );
      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.artifactId).toBe(
          "12345678-1234-1234-1234-123456789012",
        );
        expect(result.artifact.extension).toBe("svg");
      }
    });

    it("parses PDF paths correctly", () => {
      const result = parseRoute(
        "/artifacts/12345678-1234-1234-1234-123456789012.pdf",
      );
      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.extension).toBe("pdf");
      }
    });

    it("identifies health endpoint", () => {
      const result = parseRoute("/health");
      expect(result.type).toBe("health");
    });

    it("returns invalid_path for malformed artifact paths", () => {
      expect(parseRoute("/artifacts/invalid.svg").type).toBe("invalid_path");
      expect(
        parseRoute("/artifacts/12345678-1234-1234-1234-123456789012").type,
      ).toBe("invalid_path");
      expect(
        parseRoute("/artifacts/12345678-1234-1234-1234-123456789012.png").type,
      ).toBe("invalid_path");
      expect(parseRoute("/artifacts/").type).toBe("invalid_path");
    });

    it("returns not_found for unknown paths", () => {
      expect(parseRoute("/unknown").type).toBe("not_found");
      expect(parseRoute("/").type).toBe("not_found");
    });
  });

  describe("getContentType", () => {
    it("returns correct content type for svg", () => {
      expect(getContentType("svg")).toBe("image/svg+xml");
    });

    it("returns correct content type for pdf", () => {
      expect(getContentType("pdf")).toBe("application/pdf");
    });
  });

  describe("artifactToS3Key", () => {
    it("generates correct S3 key", () => {
      const artifact: ArtifactRef = {
        artifactId: "12345678-1234-1234-1234-123456789012",
        extension: "svg",
      };
      expect(artifactToS3Key(artifact)).toBe(
        "12345678-1234-1234-1234-123456789012.svg",
      );
    });
  });
});
