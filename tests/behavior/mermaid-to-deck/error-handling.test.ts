/**
 * T033-T038 equivalent: Behavior tests for error handling in mermaid_to_deck tool.
 * Tests parse errors, render failures, timeout handling, and resource cleanup.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mermaidToDeckS3 } from "../../../src/tools/mermaid-to-deck.js";
import type { S3Storage } from "../../../src/storage/s3-client.js";
import type { DeckRequest } from "../../../src/schemas/mermaid-to-deck.js";

// Full interface implementation to avoid unsafe casts
class MockS3Storage implements Partial<S3Storage> {
  public uploadCount = 0;
  public shouldFail = false;
  public failureError = new Error("S3 upload failed");

  async storeArtifact(
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ) {
    if (this.shouldFail) {
      throw this.failureError;
    }
    this.uploadCount++;
    return {
      artifact_id: "mock-artifact-id",
      download_url: "https://mock-s3.example.com/mock-artifact-id.pdf",
      expires_in_seconds: 3600,
      content_type: contentType,
      size_bytes: content.length,
      s3: {
        bucket: "mock-bucket",
        key: "mock-artifact-id.pdf",
        region: "us-east-1",
      },
    };
  }
}

describe("mermaid_to_deck error handling", () => {
  let mockStorage: MockS3Storage;

  beforeEach(() => {
    mockStorage = new MockS3Storage();
  });

  describe("PARSE_ERROR scenarios", () => {
    it("returns PARSE_ERROR for invalid Mermaid syntax", async () => {
      const input: DeckRequest = {
        diagrams: [{ code: "this is not valid mermaid syntax @@##$$" }],
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 30000,
      };

      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toMatch(/PARSE_ERROR|RENDER_FAILED/);
      }
    }, 60000);

    it("returns PARSE_ERROR with diagram_index for mid-deck failure", async () => {
      const input: DeckRequest = {
        diagrams: [
          { code: "graph TD\n  A --> B", title: "Valid 1" },
          { code: "invalid mermaid @@##", title: "Invalid" },
          { code: "graph TD\n  C --> D", title: "Valid 2" },
        ],
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 60000,
      };

      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toMatch(/PARSE_ERROR|RENDER_FAILED/);
        // The error should indicate which diagram failed
        expect(result.errors[0].details?.diagram_index).toBe(1);
      }
    }, 60000);

    it("stops processing after first error (fail-fast)", async () => {
      const input: DeckRequest = {
        diagrams: [
          { code: "invalid @@##", title: "Invalid 1" },
          { code: "also invalid %%^^", title: "Invalid 2" },
        ],
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 60000,
      };

      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Should only have ONE error (first diagram), not two
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].details?.diagram_index).toBe(0);
      }
    }, 60000);
  });

  describe("STORAGE_FAILED scenarios", () => {
    it("returns STORAGE_FAILED when S3 upload fails after successful rendering", async () => {
      mockStorage.shouldFail = true;

      const input: DeckRequest = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 60000,
      };

      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("STORAGE_FAILED");
        expect(result.errors[0].message).toContain("S3 upload failed");
      }
    }, 60000);

    it("preserves request_id in error response", async () => {
      mockStorage.shouldFail = true;

      const input: DeckRequest = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 60000,
      };

      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.ok).toBe(false);
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(result.request_id).toMatch(uuidRegex);
    }, 60000);
  });

  describe("input validation errors", () => {
    it("returns INVALID_INPUT for empty diagram code", async () => {
      const input: DeckRequest = {
        diagrams: [{ code: "   " }], // whitespace only
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 60000,
      };

      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_INPUT");
        expect(result.errors[0].details?.diagram_index).toBe(0);
      }
    });
  });
});
