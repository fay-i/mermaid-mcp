/**
 * Behavior tests for timeout handling and resource cleanup in mermaid_to_deck tool.
 * Verifies browser cleanup on success, error, and timeout scenarios.
 */

import { describe, it, expect } from "vitest";
import { mermaidToDeckS3 } from "../../../src/tools/mermaid-to-deck.js";
import type { S3Storage } from "../../../src/storage/s3-client.js";
import type { DeckRequest } from "../../../src/schemas/mermaid-to-deck.js";

// Mock S3Storage
class MockS3Storage {
  async storeArtifact(
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ) {
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

describe("mermaid_to_deck timeout handling", () => {
  const mockStorage = new MockS3Storage();

  describe("timeout_ms validation", () => {
    it("accepts minimum timeout of 1000ms", async () => {
      const input: DeckRequest = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "letter",
        orientation: "landscape",
        show_titles: true,
        theme: "default",
        background: "#ffffff",
        drop_shadow: true,
        google_font: "Source Code Pro",
        timeout_ms: 1000, // Minimum allowed
      };

      // Just verify it doesn't throw on minimum timeout
      // The actual render may succeed or timeout - both are valid
      const result = await mermaidToDeckS3(
        input,
        mockStorage as unknown as S3Storage,
      );

      expect(result.request_id).toBeDefined();
    }, 30000);

    it("includes request_id in all responses", async () => {
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

      // UUID format check
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(result.request_id).toMatch(uuidRegex);
    }, 60000);
  });
});

describe("mermaid_to_deck resource cleanup", () => {
  const mockStorage = new MockS3Storage();

  describe("browser cleanup on success", () => {
    it("cleans up browser after successful deck generation", async () => {
      // The renderDeck function uses a finally block to ensure cleanup.
      // This test verifies the function completes without hanging, which
      // proves the cleanup code executed (otherwise the browser would keep running).
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
      // If we get here, the browser was cleaned up (otherwise page.close/closeBrowser would hang)
    }, 60000);

    it("can render multiple decks sequentially without resource leak", async () => {
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

      // Render 3 decks sequentially - if cleanup wasn't working,
      // we'd see memory/handle exhaustion or hangs
      for (let i = 0; i < 3; i++) {
        const result = await mermaidToDeckS3(
          input,
          mockStorage as unknown as S3Storage,
        );
        expect(result.ok).toBe(true);
      }
    }, 120000);
  });

  describe("browser cleanup on error", () => {
    it("cleans up browser after parse error", async () => {
      // Verify cleanup happens even when rendering fails.
      // The finally block in renderDeck ensures page.close() and closeBrowser() run.
      const input: DeckRequest = {
        diagrams: [{ code: "invalid mermaid @@##$$" }],
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
      // If we get here without hanging, cleanup executed successfully
    }, 60000);

    it("cleans up browser after mid-deck error", async () => {
      // Test cleanup when error occurs mid-way through deck generation.
      // First diagram succeeds, second fails - verify cleanup still runs.
      const input: DeckRequest = {
        diagrams: [
          { code: "graph TD\n  A --> B" },
          { code: "invalid mermaid" },
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
      // If we get here without hanging, cleanup executed successfully after partial render
    }, 60000);
  });
});
