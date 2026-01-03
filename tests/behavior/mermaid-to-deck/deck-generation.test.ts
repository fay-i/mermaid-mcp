/**
 * T009-T010: Behavior tests for successful deck generation.
 * Tests 3-diagram deck and page count matching.
 */

import { describe, it, expect } from "vitest";
import { mermaidToDeckS3 } from "../../../src/tools/mermaid-to-deck.js";
import type { S3Storage } from "../../../src/storage/s3-client.js";
import type { DeckRequest } from "../../../src/schemas/mermaid-to-deck.js";

// Mock S3Storage that captures uploaded content
class MockS3Storage {
  public lastUpload: { content: Buffer; contentType: string } | null = null;

  async storeArtifact(
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ) {
    this.lastUpload = { content, contentType };
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

describe("mermaid_to_deck deck generation", () => {
  const mockStorage = new MockS3Storage();

  describe("T009: successful 3-diagram deck generation", () => {
    it("generates a PDF deck from 3 valid diagrams", async () => {
      const input: DeckRequest = {
        diagrams: [
          { code: "graph TD\n  A[Start] --> B[End]", title: "Flow 1" },
          {
            code: "sequenceDiagram\n  Alice->>Bob: Hello",
            title: "Sequence",
          },
          {
            code: 'pie\n  title My Pie\n  "A": 40\n  "B": 60',
            title: "Pie Chart",
          },
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.page_count).toBe(3);
        expect(result.pages).toHaveLength(3);
        expect(result.artifact_id).toBeDefined();
        expect(result.download_url).toBeDefined();
        expect(result.content_type).toBe("application/pdf");
      }
    }, 60000);

    it("returns valid UUID request_id", async () => {
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

      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(result.request_id).toMatch(uuidRegex);
    }, 60000);

    it("returns curl_command for downloading the deck", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.curl_command).toContain("curl -o");
        expect(result.curl_command).toContain(".pdf");
      }
    }, 60000);

    it("returns S3 location details", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.s3).toBeDefined();
        expect(result.s3.bucket).toBeDefined();
        expect(result.s3.key).toBeDefined();
        expect(result.s3.region).toBeDefined();
      }
    }, 60000);

    it("returns expires_in_seconds", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.expires_in_seconds).toBeGreaterThan(0);
      }
    }, 60000);

    it("returns size_bytes of the generated PDF", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.size_bytes).toBeGreaterThan(0);
      }
    }, 60000);

    it("returns empty errors array on success", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.errors).toHaveLength(0);
      }
    }, 60000);

    it("returns warnings array (may be empty)", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    }, 60000);
  });

  describe("T010: page count matching diagram count", () => {
    it("generates 1-page deck for 1 diagram", async () => {
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.page_count).toBe(1);
        expect(result.pages).toHaveLength(1);
      }
    }, 60000);

    it("generates 5-page deck for 5 diagrams", async () => {
      const input: DeckRequest = {
        diagrams: Array.from({ length: 5 }, (_, i) => ({
          code: `graph TD\n  A${i} --> B${i}`,
          title: `Page ${i + 1}`,
        })),
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.page_count).toBe(5);
        expect(result.pages).toHaveLength(5);
      }
    }, 60000);

    it("page indices are zero-based and sequential", async () => {
      const input: DeckRequest = {
        diagrams: [
          { code: "graph TD\n  A --> B", title: "First" },
          { code: "graph TD\n  C --> D", title: "Second" },
          { code: "graph TD\n  E --> F", title: "Third" },
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.pages[0].index).toBe(0);
        expect(result.pages[1].index).toBe(1);
        expect(result.pages[2].index).toBe(2);
      }
    }, 60000);

    it("page metadata includes titles from input", async () => {
      const input: DeckRequest = {
        diagrams: [
          { code: "graph TD\n  A --> B", title: "My Title" },
          { code: "graph TD\n  C --> D" }, // No title
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.pages[0].title).toBe("My Title");
        expect(result.pages[1].title).toBeUndefined();
      }
    }, 60000);
  });

  describe("PDF content validation", () => {
    it("uploads valid PDF to S3", async () => {
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

      await mermaidToDeckS3(input, mockStorage as unknown as S3Storage);

      expect(mockStorage.lastUpload).not.toBeNull();
      const upload = mockStorage.lastUpload;
      expect(upload?.contentType).toBe("application/pdf");

      // Check PDF magic bytes
      const pdfHeader = upload?.content.slice(0, 5).toString();
      expect(pdfHeader).toBe("%PDF-");
    }, 60000);
  });
});
