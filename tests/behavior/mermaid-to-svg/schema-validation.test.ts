import { describe, expect, it } from "vitest";
import {
  MermaidToSvgInputSchema,
  MermaidToSvgOutputSchema,
  MermaidToSvgSuccessOutputSchema,
  MermaidToSvgErrorOutputSchema,
} from "../../../src/schemas/mermaid-to-svg.js";

describe("MermaidToSvgInputSchema", () => {
  describe("code field validation", () => {
    it("rejects empty code", () => {
      const result = MermaidToSvgInputSchema.safeParse({ code: "" });
      expect(result.success).toBe(false);
    });

    it("rejects code exceeding 1MB", () => {
      const largeCode = "A".repeat(1_048_577); // 1MB + 1 byte
      const result = MermaidToSvgInputSchema.safeParse({ code: largeCode });
      expect(result.success).toBe(false);
    });

    it("accepts code exactly at 1MB limit", () => {
      const maxCode = "A".repeat(1_048_576); // exactly 1MB
      const result = MermaidToSvgInputSchema.safeParse({ code: maxCode });
      expect(result.success).toBe(true);
    });
  });

  describe("theme field validation", () => {
    it("rejects invalid theme", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        theme: "invalid-theme",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid themes", () => {
      const themes = ["default", "dark", "forest", "neutral"] as const;
      for (const theme of themes) {
        const result = MermaidToSvgInputSchema.safeParse({
          code: "graph TD\n  A --> B",
          theme,
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts missing theme (optional)", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("timeout_ms field validation", () => {
    it("rejects timeout_ms below 1000", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 999,
      });
      expect(result.success).toBe(false);
    });

    it("rejects timeout_ms above 120000", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 120001,
      });
      expect(result.success).toBe(false);
    });

    it("accepts timeout_ms at minimum (1000)", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 1000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts timeout_ms at maximum (120000)", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 120000,
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-integer timeout_ms", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 5000.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("valid input acceptance", () => {
    it("accepts minimal valid input", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "graph TD\n  A --> B",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe("graph TD\n  A --> B");
      }
    });

    it("accepts full valid input", () => {
      const result = MermaidToSvgInputSchema.safeParse({
        code: "sequenceDiagram\n  Alice->>Bob: Hello",
        theme: "dark",
        background: "transparent",
        config_json: '{"theme":"neutral"}',
        timeout_ms: 10000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.theme).toBe("dark");
        expect(result.data.background).toBe("transparent");
        expect(result.data.config_json).toBe('{"theme":"neutral"}');
        expect(result.data.timeout_ms).toBe(10000);
      }
    });
  });
});

describe("MermaidToSvgOutputSchema", () => {
  describe("success response validation", () => {
    it("validates correct success response", () => {
      const successResponse = {
        ok: true,
        request_id: "550e8400-e29b-41d4-a716-446655440000",
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>',
        warnings: [],
        errors: [],
      };
      const result = MermaidToSvgOutputSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
    });

    it("validates success response with warnings", () => {
      const successResponse = {
        ok: true,
        request_id: "550e8400-e29b-41d4-a716-446655440000",
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>',
        warnings: [
          { code: "DEPRECATED_SYNTAX", message: "Using deprecated syntax" },
        ],
        errors: [],
      };
      const result = MermaidToSvgOutputSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("error response validation", () => {
    it("validates correct error response", () => {
      const errorResponse = {
        ok: false,
        request_id: "550e8400-e29b-41d4-a716-446655440001",
        warnings: [],
        errors: [
          {
            code: "PARSE_ERROR",
            message: "Syntax error at line 2, column 5",
            details: { line: 2, column: 5 },
          },
        ],
      };
      const result = MermaidToSvgOutputSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it("error response MUST NOT have svg field", () => {
      const invalidErrorResponse = {
        ok: false,
        request_id: "550e8400-e29b-41d4-a716-446655440001",
        svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        warnings: [],
        errors: [{ code: "PARSE_ERROR", message: "Error" }],
      };
      const result =
        MermaidToSvgErrorOutputSchema.safeParse(invalidErrorResponse);
      expect(result.success).toBe(false);
    });

    it("error response requires at least one error", () => {
      const invalidErrorResponse = {
        ok: false,
        request_id: "550e8400-e29b-41d4-a716-446655440001",
        warnings: [],
        errors: [],
      };
      const result =
        MermaidToSvgErrorOutputSchema.safeParse(invalidErrorResponse);
      expect(result.success).toBe(false);
    });

    it("validates all error codes", () => {
      const errorCodes = [
        "INVALID_INPUT",
        "INPUT_TOO_LARGE",
        "PARSE_ERROR",
        "UNSUPPORTED_DIAGRAM",
        "INVALID_CONFIG",
        "INVALID_TIMEOUT",
        "RENDER_TIMEOUT",
        "RENDER_FAILED",
      ] as const;

      for (const code of errorCodes) {
        const errorResponse = {
          ok: false,
          request_id: "550e8400-e29b-41d4-a716-446655440001",
          warnings: [],
          errors: [{ code, message: `Error: ${code}` }],
        };
        const result = MermaidToSvgOutputSchema.safeParse(errorResponse);
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("MermaidToSvgSuccessOutputSchema", () => {
  it("requires ok to be true", () => {
    const invalidSuccess = {
      ok: false,
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      warnings: [],
      errors: [],
    };
    const result = MermaidToSvgSuccessOutputSchema.safeParse(invalidSuccess);
    expect(result.success).toBe(false);
  });

  it("requires svg field", () => {
    const missingSvg = {
      ok: true,
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      warnings: [],
      errors: [],
    };
    const result = MermaidToSvgSuccessOutputSchema.safeParse(missingSvg);
    expect(result.success).toBe(false);
  });

  it("success response errors array must be empty", () => {
    const successWithErrors = {
      ok: true,
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      warnings: [],
      errors: [{ code: "PARSE_ERROR", message: "Error" }],
    };
    const result = MermaidToSvgSuccessOutputSchema.safeParse(successWithErrors);
    expect(result.success).toBe(false);
  });
});
