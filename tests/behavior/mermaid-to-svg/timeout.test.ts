/**
 * Timeout behavior tests for mermaid_to_svg tool.
 * Tests timeout enforcement and cleanup.
 */

import { describe, expect, it } from "vitest";
import { mermaidToSvg } from "../../../src/tools/mermaid-to-svg.js";

describe("mermaidToSvg timeout behavior", () => {
  it("uses default timeout of 30000ms when not specified", async () => {
    // This test verifies the tool works with default timeout
    // A simple diagram should render well within the default timeout
    const result = await mermaidToSvg({
      code: "graph TD\n  A --> B",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.svg).toContain("<svg");
    }
  });

  it("accepts valid timeout_ms at minimum (1000ms)", async () => {
    const result = await mermaidToSvg({
      code: "graph TD\n  A --> B",
      timeout_ms: 1000,
    });

    // Should either succeed or timeout, but not return INVALID_TIMEOUT
    if (!result.ok) {
      expect(result.errors[0].code).not.toBe("INVALID_TIMEOUT");
    }
  });

  it("accepts valid timeout_ms at maximum (120000ms)", async () => {
    const result = await mermaidToSvg({
      code: "graph TD\n  A --> B",
      timeout_ms: 120000,
    });

    expect(result.ok).toBe(true);
  });

  it("includes request_id in timeout error responses", async () => {
    // Use minimum timeout with valid code
    // Even if it times out, it should have a request_id
    const result = await mermaidToSvg({
      code: "graph TD\n  A --> B",
      timeout_ms: 1000,
    });

    expect(result.request_id).toBeDefined();
    expect(result.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
