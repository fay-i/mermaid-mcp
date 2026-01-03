/**
 * PDF deck assembly using pdf-lib.
 * Combines multiple PDF pages into a single deck.
 */

import { PDFDocument } from "pdf-lib";
import type { Margins } from "../schemas/mermaid-to-deck.js";
import type { DiagramType, PageMetadata } from "../schemas/deck-response.js";

/**
 * Page generation options.
 */
export interface PageOptions {
  /** Page width in points */
  width: number;
  /** Page height in points */
  height: number;
  /** Page margins */
  margins: Margins;
  /** Background color (CSS color) */
  background: string;
  /** Whether to show the title */
  showTitle: boolean;
}

/**
 * HTML page content for Puppeteer PDF conversion.
 */
export interface HtmlPage {
  /** Full HTML document string */
  html: string;
  /** Page width in points */
  width: number;
  /** Page height in points */
  height: number;
}

/**
 * Result of assembling a PDF deck.
 */
export interface DeckAssemblyResult {
  /** Assembled PDF as Buffer */
  pdfBuffer: Buffer;
  /** Size in bytes */
  sizeBytes: number;
  /** Number of pages */
  pageCount: number;
}

/**
 * Diagram type detection patterns.
 * Matches the first non-empty, non-comment line of Mermaid code.
 */
const DIAGRAM_TYPE_PATTERNS: [DiagramType, RegExp][] = [
  ["flowchart", /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i],
  ["sequence", /^sequenceDiagram/i],
  ["class", /^classDiagram/i],
  ["state", /^stateDiagram(-v2)?/i],
  ["er", /^erDiagram/i],
  ["journey", /^journey/i],
  ["gantt", /^gantt/i],
  ["pie", /^pie/i],
  ["mindmap", /^mindmap/i],
  ["timeline", /^timeline/i],
  ["quadrant", /^quadrantChart/i],
  ["git", /^gitGraph/i],
];

/**
 * Detect the Mermaid diagram type from source code.
 *
 * @param code - Mermaid diagram source code
 * @returns Detected diagram type or "unknown"
 */
export function detectDiagramType(code: string): DiagramType {
  // Find first non-empty, non-comment line
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed.length === 0 || trimmed.startsWith("%%")) {
      continue;
    }
    // Check against patterns
    for (const [type, pattern] of DIAGRAM_TYPE_PATTERNS) {
      if (pattern.test(trimmed)) {
        return type;
      }
    }
    // First content line didn't match any pattern
    break;
  }
  return "unknown";
}

/**
 * Escape HTML special characters for safe embedding.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Create HTML page content for a diagram.
 *
 * @param svg - Rendered SVG content
 * @param title - Optional page title
 * @param options - Page layout options
 * @returns HTML page content ready for PDF conversion
 */
export function createPageHtml(
  svg: string,
  title: string | undefined,
  options: PageOptions,
): HtmlPage {
  const { width, height, margins, background, showTitle } = options;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    body {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px;
      background: ${background};
    }
    .title {
      font-family: 'Source Code Pro', 'SF Mono', monospace;
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 16px;
      color: #333;
      flex-shrink: 0;
      text-align: center;
    }
    .diagram {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      overflow: hidden;
    }
    .diagram svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  ${showTitle && title ? `<div class="title">${escapeHtml(title)}</div>` : ""}
  <div class="diagram">${svg}</div>
</body>
</html>`;

  return { html, width, height };
}

/**
 * Assemble multiple PDF pages into a single deck.
 *
 * @param pageBuffers - Array of single-page PDF buffers
 * @returns Assembled PDF deck
 */
export async function assembleDeck(
  pageBuffers: Buffer[],
): Promise<DeckAssemblyResult> {
  const finalPdf = await PDFDocument.create();

  for (const pdfBytes of pageBuffers) {
    const tempDoc = await PDFDocument.load(pdfBytes);
    const [copiedPage] = await finalPdf.copyPages(tempDoc, [0]);
    finalPdf.addPage(copiedPage);
  }

  const pdfBytes = await finalPdf.save();
  const pdfBuffer = Buffer.from(pdfBytes);

  return {
    pdfBuffer,
    sizeBytes: pdfBuffer.length,
    pageCount: pageBuffers.length,
  };
}

/**
 * Build page metadata for the response.
 *
 * @param diagrams - Input diagrams with optional titles
 * @returns Array of page metadata
 */
export function buildPageMetadata(
  diagrams: Array<{ code: string; title?: string }>,
): PageMetadata[] {
  return diagrams.map((diagram, index) => ({
    index,
    title: diagram.title,
    diagram_type: detectDiagramType(diagram.code),
  }));
}
