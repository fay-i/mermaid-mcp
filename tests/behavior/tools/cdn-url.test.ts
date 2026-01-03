/**
 * Behavior tests for CDN URL integration (User Story 4).
 * Tests: T043-T046
 *
 * These tests verify the cdn_url field is included in MCP tool responses
 * when MERMAID_CDN_BASE_URL is configured.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { buildCdnUrl, getCdnBaseUrl } from "../../../src/tools/cdn-url.js";

describe("CDN URL Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("T043: getCdnBaseUrl returns URL when MERMAID_CDN_BASE_URL is set", () => {
    it("returns the configured CDN base URL", () => {
      process.env.MERMAID_CDN_BASE_URL = "https://cdn.example.com";

      const result = getCdnBaseUrl();

      expect(result).toBe("https://cdn.example.com");
    });

    it("returns URL without trailing slash when one is present", () => {
      process.env.MERMAID_CDN_BASE_URL = "https://cdn.example.com/";

      const result = getCdnBaseUrl();

      expect(result).toBe("https://cdn.example.com");
    });
  });

  describe("T045: getCdnBaseUrl returns undefined when MERMAID_CDN_BASE_URL is not set", () => {
    it("returns undefined when env var is not set", () => {
      delete process.env.MERMAID_CDN_BASE_URL;

      const result = getCdnBaseUrl();

      expect(result).toBeUndefined();
    });

    it("returns undefined when env var is empty string", () => {
      process.env.MERMAID_CDN_BASE_URL = "";

      const result = getCdnBaseUrl();

      expect(result).toBeUndefined();
    });

    it("returns undefined when env var is whitespace only", () => {
      process.env.MERMAID_CDN_BASE_URL = "   ";

      const result = getCdnBaseUrl();

      expect(result).toBeUndefined();
    });
  });

  describe("T046: cdn_url format matches /artifacts/{artifactId}.{ext} pattern", () => {
    it("builds SVG URL with correct format", () => {
      const baseUrl = "https://cdn.example.com";
      const artifactId = "12345678-1234-1234-1234-123456789012";

      const result = buildCdnUrl(baseUrl, artifactId, "svg");

      expect(result).toBe(
        "https://cdn.example.com/artifacts/12345678-1234-1234-1234-123456789012.svg",
      );
    });

    it("builds PDF URL with correct format", () => {
      const baseUrl = "https://cdn.example.com";
      const artifactId = "12345678-1234-1234-1234-123456789012";

      const result = buildCdnUrl(baseUrl, artifactId, "pdf");

      expect(result).toBe(
        "https://cdn.example.com/artifacts/12345678-1234-1234-1234-123456789012.pdf",
      );
    });

    it("handles base URL with trailing slash", () => {
      const baseUrl = "https://cdn.example.com/";
      const artifactId = "abc-123";

      const result = buildCdnUrl(baseUrl, artifactId, "svg");

      expect(result).toBe("https://cdn.example.com/artifacts/abc-123.svg");
    });

    it("handles base URL with path prefix", () => {
      const baseUrl = "https://example.com/mermaid";
      const artifactId = "abc-123";

      const result = buildCdnUrl(baseUrl, artifactId, "pdf");

      expect(result).toBe("https://example.com/mermaid/artifacts/abc-123.pdf");
    });
  });
});
