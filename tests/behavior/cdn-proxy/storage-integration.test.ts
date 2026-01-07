/**
 * Integration tests for CDN Proxy storage backends (User Story 3).
 * Tests: T061, T062
 *
 * These tests verify that the CDN proxy correctly serves artifacts
 * from both local storage and S3 storage backends.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { handleLocalFile } from "../../../src/cdn-proxy/handlers/local-file-handler.js";
import { handleArtifact } from "../../../src/cdn-proxy/handlers/artifact.js";
import { parseRoute } from "../../../src/cdn-proxy/router.js";
import { createRequestContext } from "../../../src/cdn-proxy/middleware.js";
import { createLocalFetcher } from "../../../src/cdn-proxy/local-fetcher.js";
import type { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import type { CdnProxyConfig } from "../../../src/cdn-proxy/types.js";

// Helper to create test server
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

describe("CDN Proxy Storage Integration", () => {
  describe("T061: CDN proxy serves local files correctly", () => {
    let testDir: string;
    let localFetcher: ReturnType<typeof createLocalFetcher>;

    beforeEach(async () => {
      testDir = join(tmpdir(), `mermaid-test-${randomUUID()}`);
      await mkdir(testDir, { recursive: true });

      localFetcher = createLocalFetcher(
        null as unknown as LocalStorageBackend,
        testDir,
      );
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should serve local SVG file via CDN proxy", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      const sessionDir = join(testDir, sessionId);
      await mkdir(sessionDir, { recursive: true });

      const content = Buffer.from("<svg>test content</svg>");
      const filePath = join(sessionDir, `${artifactId}.svg`);
      await writeFile(filePath, content);

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleLocalFile(res, ctx, route.artifact, {
            localFetcher,
          });
        }
      });

      try {
        const response = await makeRequest(
          url,
          `/artifacts/${sessionId}/${artifactId}.svg`,
        );

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("image/svg+xml");
        expect(response.headers["x-storage-backend"]).toBe("local");
        expect(response.headers["x-session-id"]).toBe(sessionId);
        expect(response.body).toEqual(content);
      } finally {
        server.close();
      }
    });

    it("should serve local PDF file via CDN proxy", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();
      const sessionDir = join(testDir, sessionId);
      await mkdir(sessionDir, { recursive: true });

      const content = Buffer.from("%PDF-1.4 test content");
      const filePath = join(sessionDir, `${artifactId}.pdf`);
      await writeFile(filePath, content);

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleLocalFile(res, ctx, route.artifact, {
            localFetcher,
          });
        }
      });

      try {
        const response = await makeRequest(
          url,
          `/artifacts/${sessionId}/${artifactId}.pdf`,
        );

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["x-storage-backend"]).toBe("local");
        expect(response.body).toEqual(content);
      } finally {
        server.close();
      }
    });

    it("should return 404 for non-existent local file", async () => {
      const sessionId = randomUUID();
      const artifactId = randomUUID();

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact") {
          await handleLocalFile(res, ctx, route.artifact, {
            localFetcher,
          });
        }
      });

      try {
        const response = await makeRequest(
          url,
          `/artifacts/${sessionId}/${artifactId}.svg`,
        );
        const body = JSON.parse(response.body.toString());

        expect(response.status).toBe(404);
        expect(body.error).toBe("ARTIFACT_NOT_FOUND");
      } finally {
        server.close();
      }
    });
  });

  describe("T062: CDN proxy serves S3 files correctly (existing behavior)", () => {
    it("should serve S3 artifacts with backward-compatible path format", async () => {
      const artifactId = randomUUID();
      const testSvg = Buffer.from("<svg>s3 content</svg>");

      // Mock S3 fetcher
      const s3Fetcher = {
        async fetch(key: string) {
          if (key === `${artifactId}.svg`) {
            return {
              content: testSvg,
              contentType: "image/svg+xml",
              contentLength: testSvg.length,
              etag: '"s3-etag"',
              lastModified: new Date(),
            };
          }
          const error = new Error("Not found");
          (error as Error & { name: string }).name = "NoSuchKey";
          throw error;
        },
        async healthCheck(): Promise<boolean> {
          return true;
        },
      };

      const config: CdnProxyConfig = {
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
        storageType: "s3",
      };

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact" && !route.artifact.sessionId) {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache: null,
          });
        }
      });

      try {
        const response = await makeRequest(url, `/artifacts/${artifactId}.svg`);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("image/svg+xml");
        expect(response.headers["x-storage-backend"]).toBe("s3");
        expect(response.body).toEqual(testSvg);
      } finally {
        server.close();
      }
    });

    it("should maintain backward compatibility with S3 path format", async () => {
      const artifactId = randomUUID();
      const testPdf = Buffer.from("%PDF-1.4 s3 content");

      const s3Fetcher = {
        async fetch(key: string) {
          if (key === `${artifactId}.pdf`) {
            return {
              content: testPdf,
              contentType: "application/pdf",
              contentLength: testPdf.length,
              etag: '"s3-etag-pdf"',
              lastModified: new Date(),
            };
          }
          const error = new Error("Not found");
          (error as Error & { name: string }).name = "NoSuchKey";
          throw error;
        },
        async healthCheck(): Promise<boolean> {
          return true;
        },
      };

      const config: CdnProxyConfig = {
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
        storageType: "s3",
      };

      const { server, url } = await createTestServer(async (req, res) => {
        const ctx = createRequestContext(req);
        const route = parseRoute(ctx.path);

        if (route.type === "artifact" && !route.artifact.sessionId) {
          await handleArtifact(res, ctx, route.artifact, {
            config,
            s3Fetcher,
            cache: null,
          });
        }
      });

      try {
        // Test backward-compatible S3 path format (no session)
        const response = await makeRequest(url, `/artifacts/${artifactId}.pdf`);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["x-storage-backend"]).toBe("s3");
        expect(response.body).toEqual(testPdf);
      } finally {
        server.close();
      }
    });
  });
});
