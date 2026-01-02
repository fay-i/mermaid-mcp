/**
 * Error handling behavior tests for mermaid_to_pdf tool.
 * Tests input validation, config parsing, and error code mapping.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mermaidToPdf } from "../../../src/tools/mermaid-to-pdf.js";

const FIXTURES_DIR = join(import.meta.dirname, "../../fixtures/mermaid");

describe("mermaidToPdf error handling", () => {
  describe("INVALID_INPUT errors", () => {
    it("returns INVALID_INPUT for empty code", async () => {
      const result = await mermaidToPdf({ code: "" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_INPUT");
        expect(result.errors[0].message).toContain("empty");
      }
    });

    it("returns INVALID_INPUT for whitespace-only code", async () => {
      const result = await mermaidToPdf({ code: "   \n\t  " });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("INPUT_TOO_LARGE errors", () => {
    it("returns INPUT_TOO_LARGE for code exceeding 1MB", async () => {
      const largeCode = "A".repeat(1_048_577); // 1MB + 1 byte
      const result = await mermaidToPdf({ code: largeCode });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INPUT_TOO_LARGE");
        expect(result.errors[0].message).toContain("1MB");
      }
    });
  });

  describe("PARSE_ERROR errors", () => {
    it("returns PARSE_ERROR for invalid Mermaid syntax", async () => {
      const invalidCode = readFileSync(
        join(FIXTURES_DIR, "invalid-syntax.mmd"),
        "utf-8",
      );
      const result = await mermaidToPdf({ code: invalidCode });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("PARSE_ERROR");
      }
    });
  });

  describe("INVALID_CONFIG errors", () => {
    it("returns INVALID_CONFIG for malformed config_json", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        config_json: "not-json",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_CONFIG");
        expect(result.errors[0].message).toContain("JSON");
      }
    });

    it("returns INVALID_CONFIG for config_json that is not an object", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        config_json: '"just a string"',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_CONFIG");
      }
    });

    it("returns INVALID_CONFIG for config_json that is an array", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        config_json: "[1, 2, 3]",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_CONFIG");
      }
    });

    it("returns INVALID_CONFIG for config_json that is null", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        config_json: "null",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_CONFIG");
      }
    });
  });

  describe("INVALID_TIMEOUT errors", () => {
    it("returns INVALID_TIMEOUT for timeout_ms below 1000", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        timeout_ms: 999,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_TIMEOUT");
        expect(result.errors[0].message).toContain("1000");
      }
    });

    it("returns INVALID_TIMEOUT for timeout_ms above 120000", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        timeout_ms: 120001,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_TIMEOUT");
        expect(result.errors[0].message).toContain("120000");
      }
    });

    it("returns INVALID_TIMEOUT for timeout_ms of zero", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        timeout_ms: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_TIMEOUT");
      }
    });
  });

  describe("request_id generation", () => {
    it("includes a valid UUID request_id in error responses", async () => {
      const result = await mermaidToPdf({ code: "" });

      expect(result.request_id).toBeDefined();
      // UUID v4 format check
      expect(result.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("generates different request_ids for different requests", async () => {
      const result1 = await mermaidToPdf({ code: "" });
      const result2 = await mermaidToPdf({ code: "" });

      expect(result1.request_id).not.toBe(result2.request_id);
    });
  });

  describe("error response structure", () => {
    it("error response has no pdf field", async () => {
      const result = await mermaidToPdf({ code: "" });

      expect(result.ok).toBe(false);
      expect("pdf" in result).toBe(false);
    });

    it("error response has empty warnings array", async () => {
      const result = await mermaidToPdf({ code: "" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.warnings).toEqual([]);
      }
    });
  });
});
