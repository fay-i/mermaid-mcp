/**
 * Multi-diagram rendering for PDF deck generation.
 * Handles browser lifecycle, SVG rendering, and PDF page creation.
 */

import type { Browser, Page } from "puppeteer";
import { launchBrowser, closeBrowser, render } from "../renderer/index.js";
import {
  createPageHtml,
  type PageOptions,
  type HtmlPage,
} from "../renderer/deck-assembler.js";
import type { DiagramInput, Theme } from "../schemas/mermaid-to-deck.js";
import type { DeckRenderError } from "../schemas/deck-response.js";

/**
 * Options for rendering a deck.
 */
export interface DeckRenderOptions {
  /** Array of diagrams to render */
  diagrams: DiagramInput[];
  /** Page layout options */
  pageOptions: PageOptions;
  /** Mermaid theme */
  theme: Theme;
  /** Apply drop shadow to nodes */
  dropShadow: boolean;
  /** Google Font for diagrams */
  googleFont: string;
  /** Global timeout budget in milliseconds */
  timeoutMs: number;
}

/**
 * Result of rendering all diagrams.
 */
export interface DeckRenderResult {
  /** Array of single-page PDF buffers */
  pageBuffers: Buffer[];
}

/**
 * Error result with diagram context.
 */
export interface DeckRenderErrorResult {
  error: DeckRenderError;
}

/**
 * Render a single diagram to SVG.
 */
async function renderDiagramToSvg(
  browser: Browser,
  code: string,
  theme: Theme,
  background: string,
  dropShadow: boolean,
  googleFont: string,
  remainingMs: number,
): Promise<{ svg: string } | { error: DeckRenderError }> {
  // Check timeout budget
  if (remainingMs <= 0) {
    return {
      error: {
        code: "RENDER_TIMEOUT",
        message: "Timeout budget exhausted before rendering could start",
      },
    };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("RENDER_TIMEOUT"));
      }, remainingMs);
    });

    const renderPromise = render(browser, {
      code,
      theme,
      background,
      dropShadow,
      googleFont,
      timeoutMs: remainingMs,
    });

    const result = await Promise.race([renderPromise, timeoutPromise]);
    return { svg: result.svg };
  } catch (error) {
    if (error instanceof Error && error.message === "RENDER_TIMEOUT") {
      return {
        error: {
          code: "RENDER_TIMEOUT",
          message: `Diagram rendering timed out after ${remainingMs}ms`,
        },
      };
    }

    // Map error to appropriate code
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("Parse error") ||
      errorMessage.includes("Syntax error") ||
      errorMessage.includes("Lexical error") ||
      errorMessage.includes("UnknownDiagramError")
    ) {
      const lineMatch = errorMessage.match(/line (\d+)/i);
      return {
        error: {
          code: "PARSE_ERROR",
          message: `Mermaid syntax error: ${errorMessage}`,
          details: lineMatch
            ? { line: Number.parseInt(lineMatch[1], 10) }
            : undefined,
        },
      };
    }

    return {
      error: {
        code: "RENDER_FAILED",
        message: `Rendering failed: ${errorMessage}`,
      },
    };
  }
}

/**
 * Convert HTML page to PDF buffer using Puppeteer.
 */
async function htmlToPdf(
  page: Page,
  htmlPage: HtmlPage,
  remainingMs: number,
): Promise<{ pdfBuffer: Buffer } | { error: DeckRenderError }> {
  if (remainingMs <= 0) {
    return {
      error: {
        code: "RENDER_TIMEOUT",
        message: "Timeout budget exhausted before PDF generation could start",
      },
    };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("PDF_TIMEOUT"));
      }, remainingMs);
    });

    await page.setContent(htmlPage.html, { waitUntil: "networkidle0" });

    const pdfPromise = page.pdf({
      printBackground: true,
      width: htmlPage.width,
      height: htmlPage.height,
      pageRanges: "1",
      scale: 1,
    });

    const pdfBytes = await Promise.race([pdfPromise, timeoutPromise]);
    return { pdfBuffer: Buffer.from(pdfBytes) };
  } catch (error) {
    if (error instanceof Error && error.message === "PDF_TIMEOUT") {
      return {
        error: {
          code: "RENDER_TIMEOUT",
          message: `PDF generation timed out`,
        },
      };
    }

    return {
      error: {
        code: "PDF_GENERATION_FAILED",
        message: `Failed to convert HTML to PDF: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

/**
 * Render all diagrams to PDF pages.
 * Uses fail-fast strategy: any error stops the entire operation.
 *
 * @param options - Rendering options
 * @returns Array of PDF page buffers or error
 */
export async function renderDeck(
  options: DeckRenderOptions,
): Promise<DeckRenderResult | DeckRenderErrorResult> {
  const { diagrams, pageOptions, theme, dropShadow, googleFont, timeoutMs } =
    options;

  const startTime = Date.now();
  const pageBuffers: Buffer[] = [];

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    for (let i = 0; i < diagrams.length; i++) {
      const diagram = diagrams[i];
      const elapsed = Date.now() - startTime;
      const remaining = timeoutMs - elapsed;

      // Check timeout before each diagram
      if (remaining <= 0) {
        return {
          error: {
            code: "RENDER_TIMEOUT",
            message: `Global timeout exceeded after ${i} diagrams`,
            details: { diagram_index: i },
          },
        };
      }

      // Render diagram to SVG
      const svgResult = await renderDiagramToSvg(
        browser,
        diagram.code,
        theme,
        pageOptions.background,
        dropShadow,
        googleFont,
        remaining,
      );

      if ("error" in svgResult) {
        return {
          error: {
            ...svgResult.error,
            details: { ...svgResult.error.details, diagram_index: i },
          },
        };
      }

      // Create HTML page
      const htmlPage = createPageHtml(
        svgResult.svg,
        diagram.title,
        pageOptions,
      );

      // Convert to PDF
      const elapsedAfterSvg = Date.now() - startTime;
      const remainingAfterSvg = timeoutMs - elapsedAfterSvg;

      const pdfResult = await htmlToPdf(page, htmlPage, remainingAfterSvg);

      if ("error" in pdfResult) {
        return {
          error: {
            ...pdfResult.error,
            details: { ...pdfResult.error.details, diagram_index: i },
          },
        };
      }

      pageBuffers.push(pdfResult.pdfBuffer);
    }

    return { pageBuffers };
  } finally {
    // Always cleanup
    await page.close();
    await closeBrowser(browser);
  }
}
