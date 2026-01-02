/**
 * Contract tests for mermaid_to_pdf tool.
 * Tests input validation and output structure per the contract schema.
 */

import { describe, expect, it } from "vitest";
import {
  MermaidToPdfInputSchema,
  MermaidToPdfOutputSchema,
  MermaidToPdfSuccessOutputSchema,
  MermaidToPdfErrorOutputSchema,
  PdfErrorCodeSchema,
} from "../../../src/schemas/mermaid-to-pdf.js";
import { mermaidToPdf } from "../../../src/tools/mermaid-to-pdf.js";

describe("MermaidToPdfInputSchema", () => {
  describe("code field validation", () => {
    it("rejects empty code", () => {
      const result = MermaidToPdfInputSchema.safeParse({ code: "" });
      expect(result.success).toBe(false);
    });

    it("rejects code exceeding 1MB", () => {
      const largeCode = "A".repeat(1_048_577); // 1MB + 1 byte
      const result = MermaidToPdfInputSchema.safeParse({ code: largeCode });
      expect(result.success).toBe(false);
    });

    it("accepts code exactly at 1MB limit", () => {
      const maxCode = "A".repeat(1_048_576); // exactly 1MB
      const result = MermaidToPdfInputSchema.safeParse({ code: maxCode });
      expect(result.success).toBe(true);
    });
  });

  describe("theme field validation", () => {
    it("rejects invalid theme", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        theme: "invalid-theme",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid themes", () => {
      const themes = ["default", "dark", "forest", "neutral"] as const;
      for (const theme of themes) {
        const result = MermaidToPdfInputSchema.safeParse({
          code: "graph TD\n  A --> B",
          theme,
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts missing theme (optional)", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("timeout_ms field validation", () => {
    it("rejects timeout_ms below 1000", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 999,
      });
      expect(result.success).toBe(false);
    });

    it("rejects timeout_ms above 120000", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 120001,
      });
      expect(result.success).toBe(false);
    });

    it("accepts timeout_ms at minimum (1000)", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 1000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts timeout_ms at maximum (120000)", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 120000,
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-integer timeout_ms", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
        timeout_ms: 5000.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("valid input acceptance", () => {
    it("accepts minimal valid input", () => {
      const result = MermaidToPdfInputSchema.safeParse({
        code: "graph TD\n  A --> B",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe("graph TD\n  A --> B");
      }
    });

    it("accepts full valid input", () => {
      const result = MermaidToPdfInputSchema.safeParse({
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

describe("MermaidToPdfOutputSchema", () => {
  describe("success response validation", () => {
    it("validates correct success response", () => {
      const successResponse = {
        ok: true,
        request_id: "550e8400-e29b-41d4-a716-446655440000",
        pdf: "JVBERi0xLjQK", // Base64-encoded PDF header
        warnings: [],
        errors: [],
      };
      const result = MermaidToPdfOutputSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
    });

    it("validates success response with warnings", () => {
      const successResponse = {
        ok: true,
        request_id: "550e8400-e29b-41d4-a716-446655440000",
        pdf: "JVBERi0xLjQK",
        warnings: [
          { code: "DEPRECATED_SYNTAX", message: "Using deprecated syntax" },
        ],
        errors: [],
      };
      const result = MermaidToPdfOutputSchema.safeParse(successResponse);
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
      const result = MermaidToPdfOutputSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it("error response MUST NOT have pdf field", () => {
      const invalidErrorResponse = {
        ok: false,
        request_id: "550e8400-e29b-41d4-a716-446655440001",
        pdf: "JVBERi0xLjQK",
        warnings: [],
        errors: [{ code: "PARSE_ERROR", message: "Error" }],
      };
      const result =
        MermaidToPdfErrorOutputSchema.safeParse(invalidErrorResponse);
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
        MermaidToPdfErrorOutputSchema.safeParse(invalidErrorResponse);
      expect(result.success).toBe(false);
    });

    it("validates all error codes including PDF_GENERATION_FAILED", () => {
      const errorCodes = [
        "INVALID_INPUT",
        "INPUT_TOO_LARGE",
        "PARSE_ERROR",
        "UNSUPPORTED_DIAGRAM",
        "INVALID_CONFIG",
        "INVALID_TIMEOUT",
        "RENDER_TIMEOUT",
        "RENDER_FAILED",
        "PDF_GENERATION_FAILED",
      ] as const;

      for (const code of errorCodes) {
        const errorResponse = {
          ok: false,
          request_id: "550e8400-e29b-41d4-a716-446655440001",
          warnings: [],
          errors: [{ code, message: `Error: ${code}` }],
        };
        const result = MermaidToPdfOutputSchema.safeParse(errorResponse);
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("MermaidToPdfSuccessOutputSchema", () => {
  it("requires ok to be true", () => {
    const invalidSuccess = {
      ok: false,
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      pdf: "JVBERi0xLjQK",
      warnings: [],
      errors: [],
    };
    const result = MermaidToPdfSuccessOutputSchema.safeParse(invalidSuccess);
    expect(result.success).toBe(false);
  });

  it("requires pdf field", () => {
    const missingPdf = {
      ok: true,
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      warnings: [],
      errors: [],
    };
    const result = MermaidToPdfSuccessOutputSchema.safeParse(missingPdf);
    expect(result.success).toBe(false);
  });

  it("success response errors array must be empty", () => {
    const successWithErrors = {
      ok: true,
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      pdf: "JVBERi0xLjQK",
      warnings: [],
      errors: [{ code: "PARSE_ERROR", message: "Error" }],
    };
    const result = MermaidToPdfSuccessOutputSchema.safeParse(successWithErrors);
    expect(result.success).toBe(false);
  });
});

describe("PdfErrorCodeSchema", () => {
  it("includes PDF_GENERATION_FAILED error code", () => {
    const result = PdfErrorCodeSchema.safeParse("PDF_GENERATION_FAILED");
    expect(result.success).toBe(true);
  });

  it("includes all SVG error codes", () => {
    const svgErrorCodes = [
      "INVALID_INPUT",
      "INPUT_TOO_LARGE",
      "PARSE_ERROR",
      "UNSUPPORTED_DIAGRAM",
      "INVALID_CONFIG",
      "INVALID_TIMEOUT",
      "RENDER_TIMEOUT",
      "RENDER_FAILED",
    ];

    for (const code of svgErrorCodes) {
      const result = PdfErrorCodeSchema.safeParse(code);
      expect(result.success).toBe(true);
    }
  });
});

describe("mermaidToPdf handler contract", () => {
  it("returns response with valid UUID request_id", async () => {
    const result = await mermaidToPdf({ code: "graph TD\n  A --> B" });

    expect(result.request_id).toBeDefined();
    // UUID v4 format check
    expect(result.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("success response conforms to output schema", async () => {
    const result = await mermaidToPdf({ code: "graph TD\n  A --> B" });

    const validationResult = MermaidToPdfOutputSchema.safeParse(result);
    expect(validationResult.success).toBe(true);
  });
});
