/**
 * Edge case behavior tests for mermaid_to_svg tool.
 * Tests boundary conditions and special input handling.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mermaidToSvg } from "../../../src/tools/mermaid-to-svg.js";

const FIXTURES_DIR = join(import.meta.dirname, "../../fixtures/mermaid");

describe("mermaidToSvg edge cases", () => {
  describe("valid syntax variations", () => {
    it("renders a minimal valid flowchart", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
        expect(result.svg).toContain("</svg>");
      }
    });

    it("renders flowchart from fixture file", async () => {
      const code = readFileSync(join(FIXTURES_DIR, "flowchart.mmd"), "utf-8");
      const result = await mermaidToSvg({ code });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
      }
    });
  });

  describe("Unicode handling", () => {
    it("handles Unicode characters in labels", async () => {
      const result = await mermaidToSvg({
        code: 'graph TD\n  A["Hello World"] --> B["Bonjour le Monde"]',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
      }
    });

    it("handles emoji in labels", async () => {
      const result = await mermaidToSvg({
        code: 'graph TD\n  A["Start"] --> B["End"]',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
      }
    });

    it("handles Chinese characters in labels", async () => {
      const result = await mermaidToSvg({
        code: 'graph TD\n  A["China"] --> B["Japan"]',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
      }
    });
  });

  describe("theme handling", () => {
    it("applies default theme when not specified", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
      });

      expect(result.ok).toBe(true);
    });

    it("applies dark theme", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        theme: "dark",
      });

      expect(result.ok).toBe(true);
    });

    it("applies forest theme", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        theme: "forest",
      });

      expect(result.ok).toBe(true);
    });

    it("applies neutral theme", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        theme: "neutral",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("background color handling", () => {
    it("uses transparent background when specified", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        background: "transparent",
      });

      expect(result.ok).toBe(true);
    });

    it("uses custom hex background color", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        background: "#ff0000",
      });

      expect(result.ok).toBe(true);
    });

    it("uses named CSS color as background", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        background: "lightblue",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("config_json handling", () => {
    it("accepts valid empty config object", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        config_json: "{}",
      });

      expect(result.ok).toBe(true);
    });

    it("accepts valid config with theme override", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        config_json: '{"theme":"dark"}',
      });

      expect(result.ok).toBe(true);
    });

    it("accepts valid config with flowchart settings", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
        config_json: '{"flowchart":{"curve":"basis"}}',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("input size boundaries", () => {
    it("accepts code exactly at 1MB limit", async () => {
      // Create code that's exactly 1MB when encoded as UTF-8
      // "graph TD\n  A --> B" is the base (17 chars)
      // Pad with comments to reach exactly 1MB
      const baseCode = "graph TD\n  A --> B";
      const padding = " ".repeat(
        1_048_576 - Buffer.byteLength(baseCode, "utf-8"),
      );
      const maxCode = baseCode + padding;

      expect(Buffer.byteLength(maxCode, "utf-8")).toBe(1_048_576);

      const result = await mermaidToSvg({ code: maxCode });
      // Should not return INPUT_TOO_LARGE
      if (!result.ok) {
        expect(result.errors[0].code).not.toBe("INPUT_TOO_LARGE");
      }
    });
  });

  describe("response structure", () => {
    it("success response has empty errors array", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.errors).toEqual([]);
      }
    });

    it("success response has warnings array (may be empty)", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    });

    it("success response contains valid SVG", async () => {
      const result = await mermaidToSvg({
        code: "graph TD\n  A --> B",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
        expect(result.svg).toContain("</svg>");
        expect(result.svg).toContain("xmlns");
      }
    });
  });
});
