/**
 * PDF validation tests for mermaid_to_pdf tool.
 * Tests PDF output quality, vector preservation, and diagram type support.
 */

import { describe, expect, it } from "vitest";
import { mermaidToPdf } from "../../../src/tools/mermaid-to-pdf.js";

describe("mermaidToPdf PDF validation", () => {
  describe("PDF magic bytes verification", () => {
    it("output is valid base64 that decodes to PDF", async () => {
      const result = await mermaidToPdf({ code: "graph TD\n  A --> B" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Decode base64 and check for PDF magic bytes
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        const header = pdfBuffer.subarray(0, 5).toString("ascii");
        expect(header).toBe("%PDF-");
      }
    });

    it("PDF has valid version in header", async () => {
      const result = await mermaidToPdf({ code: "graph TD\n  A --> B" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        const header = pdfBuffer.subarray(0, 8).toString("ascii");
        // PDF version like %PDF-1.4 or %PDF-1.7
        expect(header).toMatch(/^%PDF-\d\.\d$/);
      }
    });
  });

  describe("vector graphics preservation", () => {
    it("PDF contains vector path operators", async () => {
      const result = await mermaidToPdf({ code: "graph TD\n  A --> B" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        const pdfContent = pdfBuffer.toString("latin1");

        // Check for vector path operators in content streams
        // 'm' = moveto, 'l' = lineto, 'c' = curveto
        // These operators appear in PDF vector content
        const hasPathOperators =
          pdfContent.includes(" m") ||
          pdfContent.includes(" l") ||
          pdfContent.includes(" c") ||
          pdfContent.includes(" re"); // rectangle operator

        expect(hasPathOperators).toBe(true);
      }
    });
  });

  describe("flowchart diagram rendering", () => {
    it("renders simple flowchart to PDF", async () => {
      const code = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[End]
  B -->|No| D[Loop]
  D --> B`;

      const result = await mermaidToPdf({ code });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.pdf).toBeDefined();
        expect(result.pdf.length).toBeGreaterThan(0);

        // Verify it's valid PDF
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });

    it("renders left-right flowchart to PDF", async () => {
      const code = `graph LR
  A --> B --> C --> D`;

      const result = await mermaidToPdf({ code });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });
  });

  describe("sequence diagram rendering", () => {
    it("renders sequence diagram to PDF", async () => {
      const code = `sequenceDiagram
  Alice->>Bob: Hello Bob
  Bob-->>Alice: Hi Alice
  Alice->>Bob: How are you?
  Bob-->>Alice: I'm good!`;

      const result = await mermaidToPdf({ code });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });
  });

  describe("theme support", () => {
    const themes = ["default", "dark", "forest", "neutral"] as const;

    for (const theme of themes) {
      it(`renders with ${theme} theme`, async () => {
        const result = await mermaidToPdf({
          code: "graph TD\n  A --> B",
          theme,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
          const pdfBuffer = Buffer.from(result.pdf, "base64");
          expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
        }
      });
    }
  });

  describe("background color support", () => {
    it("renders with white background", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        background: "white",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });

    it("renders with transparent background", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        background: "transparent",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });

    it("renders with custom hex background", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        background: "#f0f0f0",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });
  });

  describe("config_json support", () => {
    it("renders with custom flowchart config", async () => {
      const result = await mermaidToPdf({
        code: "graph TD\n  A --> B",
        config_json: '{"flowchart":{"curve":"basis"}}',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
    });
  });

  describe("output size validation", () => {
    it("produces reasonably sized PDF for simple diagram", async () => {
      const result = await mermaidToPdf({ code: "graph TD\n  A --> B" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const pdfBuffer = Buffer.from(result.pdf, "base64");
        // Simple diagram should be between 1KB and 100KB
        expect(pdfBuffer.length).toBeGreaterThan(1000);
        expect(pdfBuffer.length).toBeLessThan(100000);
      }
    });
  });
});
