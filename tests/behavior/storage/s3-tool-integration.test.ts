/**
 * Behavior tests for S3 tool integration.
 * Tests error mapping and fallback behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mermaidToSvgS3 } from "../../../src/tools/mermaid-to-svg.js";
import { mermaidToPdfS3 } from "../../../src/tools/mermaid-to-pdf.js";
import type { S3Storage } from "../../../src/storage/s3-client.js";

describe("mermaid_to_svg S3 integration", () => {
  let mockStorage: S3Storage;
  let mockStoreArtifact: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStoreArtifact = vi.fn();
    mockStorage = {
      storeArtifact: mockStoreArtifact,
      cleanupOldArtifacts: vi.fn().mockResolvedValue(0),
      healthCheck: vi.fn().mockResolvedValue(true),
    } as unknown as S3Storage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storage failure handling", () => {
    it("returns STORAGE_FAILED error when S3 upload fails", async () => {
      mockStoreArtifact.mockRejectedValue(new Error("S3 connection refused"));

      const result = await mermaidToSvgS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("STORAGE_FAILED");
        expect(result.errors[0].message).toContain("S3 connection refused");
      }
    });

    it("returns STORAGE_FAILED error with generic message for non-Error exceptions", async () => {
      mockStoreArtifact.mockRejectedValue("string error");

      const result = await mermaidToSvgS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("STORAGE_FAILED");
        expect(result.errors[0].message).toContain("string error");
      }
    });

    it("preserves request_id in error response", async () => {
      mockStoreArtifact.mockRejectedValue(new Error("Upload failed"));

      const result = await mermaidToSvgS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe("Success path", () => {
    it("returns presigned URL on successful upload", async () => {
      mockStoreArtifact.mockResolvedValue({
        artifact_id: "test-uuid",
        download_url: "https://s3.example.com/test-uuid.svg",
        expires_in_seconds: 3600,
        content_type: "image/svg+xml",
        size_bytes: 1024,
        s3: {
          bucket: "test-bucket",
          key: "test-uuid.svg",
          region: "us-east-1",
        },
      });

      const result = await mermaidToSvgS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.artifact_id).toBe("test-uuid");
        expect(result.download_url).toContain("s3.example.com");
        expect(result.content_type).toBe("image/svg+xml");
      }
    });

    it("includes curl_command in success response", async () => {
      mockStoreArtifact.mockResolvedValue({
        artifact_id: "abc-123",
        download_url: "https://s3.example.com/abc-123.svg",
        expires_in_seconds: 3600,
        content_type: "image/svg+xml",
        size_bytes: 1024,
        s3: {
          bucket: "test-bucket",
          key: "abc-123.svg",
          region: "us-east-1",
        },
      });

      const result = await mermaidToSvgS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.curl_command).toContain("curl -o");
        expect(result.curl_command).toContain("abc-123.svg");
      }
    });
  });

  describe("Input validation", () => {
    it("returns INVALID_INPUT for empty code before S3 upload", async () => {
      const result = await mermaidToSvgS3({ code: "" }, mockStorage);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_INPUT");
      }
      expect(mockStoreArtifact).not.toHaveBeenCalled();
    });

    it("returns INVALID_TIMEOUT for invalid timeout before S3 upload", async () => {
      const result = await mermaidToSvgS3(
        { code: "graph TD; A-->B", timeout_ms: 500 },
        mockStorage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_TIMEOUT");
      }
      expect(mockStoreArtifact).not.toHaveBeenCalled();
    });
  });
});

describe("mermaid_to_pdf S3 integration", () => {
  let mockStorage: S3Storage;
  let mockStoreArtifact: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStoreArtifact = vi.fn();
    mockStorage = {
      storeArtifact: mockStoreArtifact,
      cleanupOldArtifacts: vi.fn().mockResolvedValue(0),
      healthCheck: vi.fn().mockResolvedValue(true),
    } as unknown as S3Storage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storage failure handling", () => {
    it("returns STORAGE_FAILED error when S3 upload fails", async () => {
      mockStoreArtifact.mockRejectedValue(new Error("Bucket not found"));

      const result = await mermaidToPdfS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("STORAGE_FAILED");
        expect(result.errors[0].message).toContain("Bucket not found");
      }
    });
  });

  describe("Success path", () => {
    it("returns presigned URL on successful upload", async () => {
      mockStoreArtifact.mockResolvedValue({
        artifact_id: "pdf-uuid",
        download_url: "https://s3.example.com/pdf-uuid.pdf",
        expires_in_seconds: 3600,
        content_type: "application/pdf",
        size_bytes: 2048,
        s3: {
          bucket: "test-bucket",
          key: "pdf-uuid.pdf",
          region: "us-east-1",
        },
      });

      const result = await mermaidToPdfS3(
        { code: "graph TD; A-->B" },
        mockStorage,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.artifact_id).toBe("pdf-uuid");
        expect(result.content_type).toBe("application/pdf");
      }
    });
  });

  describe("Input validation", () => {
    it("returns INVALID_INPUT for empty code before S3 upload", async () => {
      const result = await mermaidToPdfS3({ code: "   " }, mockStorage);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_INPUT");
      }
      expect(mockStoreArtifact).not.toHaveBeenCalled();
    });
  });
});
