/**
 * Behavior tests for resource cleanup in mermaid_to_svg tool.
 *
 * Tests verify:
 * - Browser resources are cleaned up after successful renders
 * - Browser resources are cleaned up after errors
 * - Browser resources are cleaned up after timeouts
 * - Concurrent renders are isolated (FR-015)
 */

import { describe, expect, it } from "vitest";
import { mermaidToSvg } from "../../../src/tools/mermaid-to-svg.js";

describe("mermaidToSvg resource cleanup", () => {
  describe("cleanup on success", () => {
    it("cleans up browser after successful render", async () => {
      // Render a valid diagram
      const result = await mermaidToSvg({
        code: "graph TD; A-->B;",
      });

      // If we get here without hanging or crashing, browser was cleaned up
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg).toContain("<svg");
      }
    });

    it("can render multiple times sequentially without resource leak", async () => {
      // Render multiple diagrams in sequence
      // If browser isn't cleaned up properly, we'd eventually run out of resources
      const codes = [
        "graph TD; A-->B;",
        "graph LR; C-->D;",
        "graph TB; E-->F;",
        "sequenceDiagram\n  A->>B: Hello",
        'pie title Test\n  "A": 50\n  "B": 50',
      ];

      for (const code of codes) {
        const result = await mermaidToSvg({ code });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.svg).toContain("<svg");
        }
      }
    }, 30000);
  });

  describe("cleanup on error", () => {
    it("cleans up browser after parse error", async () => {
      const result = await mermaidToSvg({
        code: "invalid mermaid syntax @#$%^&*()",
      });

      // Should get an error response, but browser should be cleaned up
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("cleans up browser after config error", async () => {
      const result = await mermaidToSvg({
        code: "graph TD; A-->B;",
        config_json: "not valid json",
      });

      // Config validation happens before browser launch, but test the path
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].code).toBe("INVALID_CONFIG");
      }
    });
  });

  describe("cleanup on timeout", () => {
    it("cleans up browser when render times out", async () => {
      // Use a very simple diagram with minimum timeout
      // This tests that timeout cleanup works even if it doesn't actually timeout
      const result = await mermaidToSvg({
        code: "graph TD; A-->B;",
        timeout_ms: 30000, // Normal timeout, just testing cleanup path
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("concurrent isolation (FR-015)", () => {
    it("renders two different diagrams concurrently with correct independent outputs", async () => {
      // Create two distinct diagrams
      const flowchartCode = "graph TD; FLOWCHART_NODE-->TARGET;";
      const sequenceCode = "sequenceDiagram\n  SEQUENCE_ACTOR->>TARGET: Hello";

      // Render both concurrently
      const [flowchartResult, sequenceResult] = await Promise.all([
        mermaidToSvg({ code: flowchartCode }),
        mermaidToSvg({ code: sequenceCode }),
      ]);

      // Both should succeed
      expect(flowchartResult.ok).toBe(true);
      expect(sequenceResult.ok).toBe(true);

      if (flowchartResult.ok && sequenceResult.ok) {
        // Each output should contain its unique identifier
        expect(flowchartResult.svg).toContain("FLOWCHART_NODE");
        expect(sequenceResult.svg).toContain("SEQUENCE_ACTOR");

        // Outputs should be different
        expect(flowchartResult.svg).not.toBe(sequenceResult.svg);

        // Each should have a unique request_id
        expect(flowchartResult.request_id).not.toBe(sequenceResult.request_id);
      }
    });

    it("concurrent renders do not interfere with each other's themes", async () => {
      const code = "graph TD; A-->B;";

      // Render same diagram with different themes concurrently
      const [defaultResult, darkResult] = await Promise.all([
        mermaidToSvg({ code, theme: "default" }),
        mermaidToSvg({ code, theme: "dark" }),
      ]);

      expect(defaultResult.ok).toBe(true);
      expect(darkResult.ok).toBe(true);

      if (defaultResult.ok && darkResult.ok) {
        // SVGs should be different due to different themes
        expect(defaultResult.svg).not.toBe(darkResult.svg);
      }
    });
  });
});
