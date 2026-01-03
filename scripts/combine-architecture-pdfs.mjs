#!/usr/bin/env node
/**
 * Combine architecture SVG diagrams into a single landscape letter-size PDF.
 * Each diagram is scaled to fit the page while maintaining aspect ratio.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";

const DOCS_DIR = join(import.meta.dirname, "../docs/architecture");
const OUTPUT_FILE = join(DOCS_DIR, "architecture-combined.pdf");

// Letter size in landscape: 11" x 8.5" (792 x 612 points at 72dpi)
const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;

const SVG_FILES = [
  "01-system-overview.svg",
  "02-component-architecture.svg",
  "03-rendering-pipeline.svg",
  "04-storage-architecture.svg",
  "05-cdn-proxy-flow.svg",
  "06-error-handling.svg",
  "07-tool-state-machine.svg",
  "08-deployment.svg",
  "09-class-diagram.svg",
  "10-theming.svg",
];

function createHtmlPage(svgContent, title) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      overflow: hidden;
    }
    body {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: white;
    }
    h1 {
      font-size: 16px;
      margin-bottom: 16px;
      color: #333;
      flex-shrink: 0;
    }
    .diagram-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      max-height: calc(100% - 48px);
      overflow: hidden;
    }
    .diagram-container svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="diagram-container">
    ${svgContent}
  </div>
</body>
</html>`;
}

function getTitleFromFilename(filename) {
  return filename
    .replace(/^\d+-/, "")
    .replace(".svg", "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function main() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });

    // Create final PDF document
    const finalPdf = await PDFDocument.create();

    for (const svgFile of SVG_FILES) {
      const svgPath = join(DOCS_DIR, svgFile);
      console.log(`Processing: ${svgFile}`);

      const svgContent = readFileSync(svgPath, "utf-8");
      const title = getTitleFromFilename(svgFile);
      const html = createHtmlPage(svgContent, title);

      await page.setContent(html, { waitUntil: "networkidle0" });

      // Generate single-page PDF for this diagram
      const pdfBytes = await page.pdf({
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        printBackground: true,
        pageRanges: "1",
      });

      // Load and append to final document
      const tempDoc = await PDFDocument.load(pdfBytes);
      const [copiedPage] = await finalPdf.copyPages(tempDoc, [0]);
      finalPdf.addPage(copiedPage);
    }

    await page.close();

    // Save combined PDF
    const finalPdfBytes = await finalPdf.save();
    writeFileSync(OUTPUT_FILE, finalPdfBytes);

    console.log(`\nCombined PDF saved to: ${OUTPUT_FILE}`);
    console.log(`Total pages: ${finalPdf.getPageCount()}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
