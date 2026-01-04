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
  const { code, background = "#ffffff", config = {} } = options;

  // Determine theme: explicit parameter > config.theme > default
  // Only use "default" if neither was provided
  type MermaidTheme = "default" | "dark" | "forest" | "neutral" | "base";
  const configTheme = config.theme as MermaidTheme | undefined;
  const resolvedTheme: MermaidTheme = options.theme ?? configTheme ?? "default";

  // Default config for 720p-friendly output
  const defaultConfig = {
    fontSize: 18,
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: "basis" as const,
      diagramPadding: 20,
      // Subgraph title margin to prevent title-node collision (Issue #138)
      // Default Mermaid values are { top: 0, bottom: 0 } which causes overlap
      subGraphTitleMargin: { top: 10, bottom: 5 },
    },
    sequence: {
      useMaxWidth: false,
      diagramMarginX: 20,
      diagramMarginY: 20,
    },
  };

  // GitHub Light theme variables (applied only for default theme)
  const githubLightThemeVariables = {
    primaryColor: "#ddf4ff",
    primaryTextColor: "#24292f",
    primaryBorderColor: "#54aeff",
    lineColor: "#57606a",
    secondaryColor: "#f6f8fa",
    tertiaryColor: "#f6f8fa",
    edgeLabelBackground: "#ffffff",
    clusterBkg: "#f6f8fa",
    clusterBorder: "#d0d7de",
    fontFamily: "Source Code Pro, monospace",
  };

  // Only apply GitHub Light defaults when using default theme and no custom themeVariables
  const shouldApplyGithubDefaults =
    resolvedTheme === "default" && !config.themeVariables;

  // Merge: defaults < user config < security settings
  // User themeVariables override defaults
  const mermaidConfig = {
    ...defaultConfig,
    ...config,
    // Preserve nested objects from defaults if user didn't override
    flowchart: { ...defaultConfig.flowchart, ...(config.flowchart as object) },
    sequence: { ...defaultConfig.sequence, ...(config.sequence as object) },
    // Apply GitHub Light theme only for default theme without custom variables
    themeVariables: shouldApplyGithubDefaults
      ? githubLightThemeVariables
      : (config.themeVariables as object | undefined),
    theme: resolvedTheme,
    // Security: encode HTML tags, disable click handlers (defense in depth)
    securityLevel: "strict" as const,
    // Deterministic output settings (T019)
    deterministicIds: true,
    deterministicIDSeed: "mermaid-mcp",
  };

  const result = await renderMermaid(browser, code, "svg", {
    backgroundColor: background,
    mermaidConfig,
  });

  // Decode Uint8Array to string
  let svg = new TextDecoder().decode(result.data);

  // Apply drop shadow post-processing if enabled
  if (options.dropShadow) {
    svg = injectDropShadow(svg);
  }

  // Inject Google Font if specified
  if (options.googleFont) {
    svg = injectGoogleFont(svg, options.googleFont);
  }

  // Extract dimensions from SVG
  const { width, height } = extractDimensions(svg);

  return {
    svg,
    width,
    height,
  };
}

/**
 * SVG filter definition for drop shadow effect.
 */
const DROP_SHADOW_FILTER = `<defs>
  <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.25"/>
  </filter>
</defs>`;

/**
 * Inject drop shadow filter into SVG and apply to nodes/clusters.
 */
function injectDropShadow(svg: string): string {
  // Find the first <g> element after the opening <svg> tag to insert defs before it
  const svgOpenMatch = svg.match(/<svg[^>]*>/);
  if (!svgOpenMatch) {
    return svg;
  }

  const insertPos = svgOpenMatch.index! + svgOpenMatch[0].length;

  // Find where to insert - after style tag if present, otherwise after svg open
  const styleEndMatch = svg.match(/<\/style>/);
  const actualInsertPos = styleEndMatch
    ? styleEndMatch.index! + styleEndMatch[0].length
    : insertPos;

  // Insert the filter definition
  svg =
    svg.slice(0, actualInsertPos) +
    DROP_SHADOW_FILTER +
    svg.slice(actualInsertPos);

  // Apply filter to node rectangles (class="node")
  // Match: <g class="node ..."><rect ... and add filter attribute to rect
  svg = svg.replace(
    /(<g\s+class="node[^"]*"[^>]*>[\s\S]*?<rect\s+class="[^"]*label-container[^"]*")(\s+style="[^"]*")?/g,
    '$1$2 filter="url(#dropShadow)"',
  );

  // Apply filter to cluster rectangles
  svg = svg.replace(
    /(<g\s+class="cluster"[^>]*>[\s\S]*?<rect)(\s+style="[^"]*")?/g,
    '$1$2 filter="url(#dropShadow)"',
  );

  return svg;
}

/**
 * Inject Google Font import into SVG for custom typography.
 */
function injectGoogleFont(svg: string, fontName: string): string {
  // Convert font name to Google Fonts URL format
  // e.g., "Source Code Pro" -> "Source+Code+Pro"
  const encodedFont = fontName.replace(/\s+/g, "+");
  // Use &amp; for XML-valid SVG
  const fontImport = `@import url('https://fonts.googleapis.com/css2?family=${encodedFont}:wght@400;500;600;700&amp;display=swap');`;

  // Find the style tag and inject the font import at the beginning
  const styleMatch = svg.match(/<style>([^<]*)<\/style>/);
  if (styleMatch) {
    const existingStyles = styleMatch[1];
    const newStyles = `<style>${fontImport}${existingStyles}</style>`;
    svg = svg.replace(styleMatch[0], newStyles);
  }

  return svg;
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
