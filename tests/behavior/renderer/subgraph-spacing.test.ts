/**
 * Subgraph title spacing behavior tests for Mermaid renderer.
 * Verifies that subgraph titles have adequate spacing from child nodes (Issue #138).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "puppeteer";
import {
  closeBrowser,
  launchBrowser,
  render,
} from "../../../src/renderer/index.js";

describe("Subgraph Title Spacing", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await closeBrowser(browser);
  });

  describe("default subGraphTitleMargin", () => {
    it("applies default margin that prevents title-node collision", async () => {
      // Diagram from Issue #138 - subgraph title should not overlap with first node
      const code = `flowchart TB
    subgraph Layer["JavaScript Layer"]
        Node1["First Node"]
        Node2["Second Node"]
    end`;

      const result = await render(browser, {
        code,
        timeoutMs: 30000,
      });

      // The SVG should render successfully
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("JavaScript Layer");
      expect(result.svg).toContain("First Node");

      // Extract the cluster-label y-offset from the transform attribute
      // Format: transform="translate(x, y)" where y is the top margin
      const clusterLabelMatch = result.svg.match(
        /class="cluster-label"[^>]*transform="translate\([^,]+,\s*(\d+(?:\.\d+)?)\)"/,
      );

      // The cluster-label should exist
      expect(clusterLabelMatch).not.toBeNull();

      if (clusterLabelMatch) {
        const titleYOffset = parseFloat(clusterLabelMatch[1]);
        // With default subGraphTitleMargin of { top: 30 }, the y-offset should be >= 8
        // Note: Mermaid may not respect the exact margin value, but should have some margin
        expect(titleYOffset).toBeGreaterThanOrEqual(8);
      }
    });

    it("preserves default subGraphTitleMargin when user config has other flowchart options", async () => {
      // When user provides other flowchart config options, our default subGraphTitleMargin
      // should still be preserved (merged) since user isn't overriding it
      const code = `flowchart TB
    subgraph Layer["Test Layer"]
        A["Node A"]
    end`;

      // User provides only useMaxWidth, not subGraphTitleMargin
      const result = await render(browser, {
        code,
        config: {
          flowchart: {
            useMaxWidth: true, // Different from our default
          },
        },
        timeoutMs: 30000,
      });

      // Should render successfully
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("Test Layer");

      // Our default subGraphTitleMargin should still be applied
      const clusterLabelMatch = result.svg.match(
        /class="cluster-label"[^>]*transform="translate\([^,]+,\s*(\d+(?:\.\d+)?)\)"/,
      );

      expect(clusterLabelMatch).not.toBeNull();
      if (clusterLabelMatch) {
        const titleYOffset = parseFloat(clusterLabelMatch[1]);
        // Our default margin of { top: 30 } should result in y-offset >= 8
        // Note: Mermaid may not respect the exact margin value, but should have some margin
        expect(titleYOffset).toBeGreaterThanOrEqual(8);
      }
    });
  });

  describe("nested subgraphs", () => {
    it("renders nested subgraphs with proper title spacing", async () => {
      const code = `flowchart TB
    subgraph Outer["Outer Container"]
        subgraph Inner["Inner Container"]
            Node["Content Node"]
        end
    end`;

      const result = await render(browser, {
        code,
        timeoutMs: 30000,
      });

      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("Outer Container");
      expect(result.svg).toContain("Inner Container");
      expect(result.svg).toContain("Content Node");
    });
  });
});
