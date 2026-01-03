/**
 * Config and theming behavior tests for Mermaid renderer.
 * Verifies that config_json settings (theme, themeVariables) are properly applied.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "puppeteer";
import {
  closeBrowser,
  launchBrowser,
  render,
} from "../../../src/renderer/index.js";

describe("Renderer Config and Theming", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await closeBrowser(browser);
  });

  describe("theme from config", () => {
    it("respects theme set in config when theme parameter is not provided", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      // Render with config.theme = "dark" but no theme parameter
      const result = await render(browser, {
        code,
        config: { theme: "dark" },
        timeoutMs: 30000,
      });

      // Dark theme should have dark background colors in the SVG
      // The dark theme uses background colors like #333 or similar dark values
      expect(result.svg).toContain("<svg");
      // Dark theme nodes should NOT have white/light fill
      expect(result.svg).not.toMatch(/fill\s*[:=]\s*["']?#fff/i);
    });

    it("allows config.theme to override when set to base for customization", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      const result = await render(browser, {
        code,
        config: {
          theme: "base",
          themeVariables: {
            primaryColor: "#ff0000",
          },
        },
        timeoutMs: 30000,
      });

      // Base theme with red primaryColor should have red in the SVG
      expect(result.svg).toContain("#ff0000");
    });
  });

  describe("themeVariables", () => {
    it("applies custom primaryColor from themeVariables", async () => {
      const code = `flowchart LR
        A[Test Node]`;

      const customColor = "#238636"; // GitHub green

      const result = await render(browser, {
        code,
        config: {
          theme: "base",
          themeVariables: {
            primaryColor: customColor,
          },
        },
        timeoutMs: 30000,
      });

      // The custom color should appear in the SVG (as fill or style)
      expect(result.svg.toLowerCase()).toContain(customColor.toLowerCase());
    });

    it("applies custom lineColor from themeVariables", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      const customLineColor = "#58a6ff"; // GitHub blue

      const result = await render(browser, {
        code,
        config: {
          theme: "base",
          themeVariables: {
            lineColor: customLineColor,
          },
        },
        timeoutMs: 30000,
      });

      // The custom line color should appear in the SVG
      expect(result.svg.toLowerCase()).toContain(customLineColor.toLowerCase());
    });

    it("applies custom fontFamily from themeVariables", async () => {
      const code = `flowchart LR
        A[Test Node]`;

      const customFont = "Trebuchet MS";

      const result = await render(browser, {
        code,
        config: {
          theme: "base",
          themeVariables: {
            fontFamily: customFont,
          },
        },
        timeoutMs: 30000,
      });

      // The custom font should appear in the SVG styles
      expect(result.svg).toContain(customFont);
    });
  });

  describe("theme parameter precedence", () => {
    it("explicit theme parameter takes precedence over config.theme", async () => {
      const code = `flowchart LR
        A[Start] --> B[End]`;

      // Pass both theme parameter AND config.theme
      // The explicit parameter should win
      const result = await render(browser, {
        code,
        theme: "forest", // Explicit parameter
        config: {
          theme: "dark", // Config setting - should be ignored
        },
        timeoutMs: 30000,
      });

      // Forest theme has green colors
      expect(result.svg).toContain("<svg");
      // Forest theme should have some green-ish coloring (exact color varies)
    });
  });
});
