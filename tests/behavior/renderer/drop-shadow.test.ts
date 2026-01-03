/**
 * Drop shadow behavior tests for Mermaid renderer.
 * Verifies that drop shadows can be applied to diagram nodes via SVG post-processing.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "puppeteer";
import {
  closeBrowser,
  launchBrowser,
  render,
} from "../../../src/renderer/index.js";

describe("Renderer Drop Shadow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await closeBrowser(browser);
  });

  describe("dropShadow option", () => {
    it("injects SVG filter definition when dropShadow is enabled", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      const result = await render(browser, {
        code,
        dropShadow: true,
        timeoutMs: 30000,
      });

      // Should contain a filter definition with feDropShadow or feGaussianBlur
      expect(result.svg).toContain("<defs>");
      expect(result.svg).toMatch(/<filter[^>]*id="dropShadow"/);
    });

    it("applies filter to node rectangles when dropShadow is enabled", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      const result = await render(browser, {
        code,
        dropShadow: true,
        timeoutMs: 30000,
      });

      // Node rects should reference the filter
      expect(result.svg).toMatch(/filter="url\(#dropShadow\)"/);
    });

    it("does not inject filter when dropShadow is false", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      const result = await render(browser, {
        code,
        dropShadow: false,
        timeoutMs: 30000,
      });

      // Should NOT contain our custom dropShadow filter
      expect(result.svg).not.toMatch(/<filter[^>]*id="dropShadow"/);
    });

    it("does not inject filter when dropShadow is not specified", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      const result = await render(browser, {
        code,
        timeoutMs: 30000,
      });

      // Should NOT contain our custom dropShadow filter
      expect(result.svg).not.toMatch(/<filter[^>]*id="dropShadow"/);
    });

    it("applies shadow to subgraph cluster rectangles", async () => {
      const code = `flowchart TB
        subgraph Group["My Group"]
          A[Node A]
        end`;

      const result = await render(browser, {
        code,
        dropShadow: true,
        timeoutMs: 30000,
      });

      // Cluster rects should also have shadows
      expect(result.svg).toContain("<defs>");
      expect(result.svg).toMatch(/<filter[^>]*id="dropShadow"/);
    });
  });
});
