/**
 * Behavior tests for CDN Proxy local file handler (User Story 3).
 * Tests: T049-T054, T054a
 *
 * These tests verify the local file serving HTTP API behavior.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { ServerResponse } from "node:http";
import type http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { handleLocalFile } from "../../../src/cdn-proxy/handlers/local-file-handler.js";
import { createLocalFetcher } from "../../../src/cdn-proxy/local-fetcher.js";
import { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import { createRequestContext } from "../../../src/cdn-proxy/middleware.js";
import type { ArtifactRef } from "../../../src/cdn-proxy/types.js";

// Mock ServerResponse
class MockResponse {
  statusCode = 0;
  headers: Record<string, string | number> = {};
  body: Buffer | null = null;
  ended = false;

  writeHead(status: number, headers?: Record<string, string | number>): void {
    this.statusCode = status;
    if (headers) {
      Object.assign(this.headers, headers);
    }
  }

  end(chunk?: Buffer | string): void {
    if (chunk) {
      this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
    this.ended = true;
  }
}

describe("handleLocalFile", () => {
  let tempDir: string;
  let backend: LocalStorageBackend;
  let localFetcher: ReturnType<typeof createLocalFetcher>;
  let sessionId: string;
  let artifactId: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-cdn-test-"));
    sessionId = randomUUID();
    artifactId = randomUUID();

    backend = new LocalStorageBackend({
      basePath: tempDir,
      hostPath: tempDir,
      urlScheme: "file",
    });

    await backend.initialize();
    localFetcher = createLocalFetcher(backend, tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("successful file retrieval", () => {
    it("should return 200 OK with file content for existing SVG file", async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from(svgContent),
        "image/svg+xml",
      );

      const artifact: ArtifactRef = {
        sessionId,
        artifactId,
        extension: "svg",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toBe("image/svg+xml");
      expect(res.headers["Content-Length"]).toBe(svgContent.length);
      expect(res.headers["X-Storage-Backend"]).toBe("local");
      expect(res.headers["X-Artifact-Id"]).toBe(artifactId);
      expect(res.headers["X-Session-Id"]).toBe(sessionId);
      expect(res.body).toEqual(Buffer.from(svgContent));
      expect(res.ended).toBe(true);
    });

    it("should return 200 OK with file content for existing PDF file", async () => {
      const pdfContent = Buffer.from("%PDF-1.4\n");
      await backend.store(sessionId, artifactId, pdfContent, "application/pdf");

      const artifact: ArtifactRef = {
        sessionId,
        artifactId,
        extension: "pdf",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.pdf`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/pdf");
      expect(res.headers["Content-Length"]).toBe(pdfContent.length);
      expect(res.headers["X-Storage-Backend"]).toBe("local");
      expect(res.body).toEqual(pdfContent);
      expect(res.ended).toBe(true);
    });

    it("should include Last-Modified header", async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from(svgContent),
        "image/svg+xml",
      );

      const artifact: ArtifactRef = {
        sessionId,
        artifactId,
        extension: "svg",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(200);
      expect(res.headers["Last-Modified"]).toBeDefined();
      expect(typeof res.headers["Last-Modified"]).toBe("string");
    });

    it("should include Cache-Control header", async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from(svgContent),
        "image/svg+xml",
      );

      const artifact: ArtifactRef = {
        sessionId,
        artifactId,
        extension: "svg",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(200);
      expect(res.headers["Cache-Control"]).toBe("public, max-age=86400");
    });
  });

  describe("error handling", () => {
    it("should return 400 INVALID_PATH if sessionId is missing", async () => {
      const artifact: ArtifactRef = {
        artifactId,
        extension: "svg",
        // sessionId is missing
      };

      const req = {
        method: "GET",
        url: `/artifacts/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(400);
      expect(res.ended).toBe(true);
    });

    it("should return 404 ARTIFACT_NOT_FOUND for non-existent file", async () => {
      const artifact: ArtifactRef = {
        sessionId,
        artifactId: randomUUID(), // Non-existent artifact
        extension: "svg",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(404);
      expect(res.ended).toBe(true);
    });

    it("should return 404 ARTIFACT_NOT_FOUND for non-existent session", async () => {
      const artifact: ArtifactRef = {
        sessionId: randomUUID(), // Non-existent session
        artifactId,
        extension: "svg",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      expect(res.statusCode).toBe(404);
      expect(res.ended).toBe(true);
    });
  });

  describe("Range header handling (FR-013a)", () => {
    it("should ignore Range header and return full content with 200 OK", async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      await backend.store(
        sessionId,
        artifactId,
        Buffer.from(svgContent),
        "image/svg+xml",
      );

      const artifact: ArtifactRef = {
        sessionId,
        artifactId,
        extension: "svg",
      };

      const req = {
        method: "GET",
        url: `/artifacts/${sessionId}/${artifactId}.svg`,
        headers: {
          host: "localhost:8101",
          range: "bytes=0-10", // Range header should be ignored
        },
      } as unknown as http.IncomingMessage;

      const res = new MockResponse() as unknown as ServerResponse;
      const ctx = createRequestContext(req);

      await handleLocalFile(res, ctx, artifact, { localFetcher });

      // Per FR-013a: Should return 200 OK (not 206 Partial Content)
      expect(res.statusCode).toBe(200);
      // Should return full content, not partial
      expect(res.body).toEqual(Buffer.from(svgContent));
      expect(res.headers["Content-Length"]).toBe(svgContent.length);
      // Should not include Content-Range header
      expect(res.headers["Content-Range"]).toBeUndefined();
    });
  });
});
