/**
 * Mermaid rendering implementation using @mermaid-js/mermaid-cli.
 */

import { renderMermaid } from "@mermaid-js/mermaid-cli";
import type { Browser } from "puppeteer";
import type { RenderOptions, RenderResult } from "./types.js";

/**
 * Render a Mermaid diagram to SVG.
 *
 * @param browser - Puppeteer browser instance (from launchBrowser)
 * @param options - Rendering options
 * @returns Rendered SVG with dimensions
 */
export async function render(
  browser: Browser,
  options: RenderOptions,
): Promise<RenderResult> {
  const {
    code,
    theme = "default",
    background = "white",
    config = {},
  } = options;

  // Merge user config with deterministic settings
  const mermaidConfig = {
    ...config,
    theme,
    // Deterministic output settings (T019)
    deterministicIds: true,
    deterministicIDSeed: "mermaid-mcp",
  };

  const result = await renderMermaid(browser, code, "svg", {
    backgroundColor: background,
    mermaidConfig,
  });

  // Decode Uint8Array to string
  const svg = new TextDecoder().decode(result.data);

  // Extract dimensions from SVG
  const { width, height } = extractDimensions(svg);

  return {
    svg,
    width,
    height,
  };
}

/**
 * Extract width and height from SVG markup.
 */
function extractDimensions(svg: string): { width: number; height: number } {
  // Try to extract from width/height attributes
  const widthMatch = svg.match(/width="([^"]+)"/);
  const heightMatch = svg.match(/height="([^"]+)"/);

  let width = 0;
  let height = 0;

  if (widthMatch) {
    width = Number.parseFloat(widthMatch[1]) || 0;
  }

  if (heightMatch) {
    height = Number.parseFloat(heightMatch[1]) || 0;
  }

  // If no width/height, try viewBox
  if (width === 0 || height === 0) {
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/);
      if (parts.length >= 4) {
        width = Number.parseFloat(parts[2]) || 0;
        height = Number.parseFloat(parts[3]) || 0;
      }
    }
  }

  return { width, height };
}
