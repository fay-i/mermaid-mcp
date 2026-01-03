# Research: PDF Deck Builder

**Date**: 2026-01-03
**Branch**: `009-pdf-deck-builder`

## Summary

This document resolves architectural decisions and research questions for the PDF deck builder MCP tool. All decisions are grounded in the existing codebase patterns and the proof-of-concept script (`scripts/combine-architecture-pdfs.mjs`).

---

## Decision 1: Sequential vs Parallel Diagram Rendering

**Decision**: Sequential rendering with browser instance reuse

**Rationale**:
- The existing `mermaid_to_pdf.ts` launches a new browser per request and closes it after. For multi-diagram decks, this is inefficient.
- The POC script demonstrates the correct pattern: launch browser once, reuse a single page for all diagrams, close browser at end.
- Sequential rendering provides predictable memory usage and simpler error handling.
- Parallel rendering with concurrency limits adds complexity (worker pools, promise coordination) without significant benefit for the expected use case (10-100 diagrams).

**Alternatives Considered**:
1. **Parallel with concurrency limit (4 at a time)**: Faster for large decks, but adds complexity for coordination and error handling. Memory spikes unpredictable.
2. **Worker pool**: Overkill for single-user MCP tool with 10-minute CI target. Would require significant infrastructure.

**Implementation Pattern**:
```typescript
const browser = await launchBrowser();
const page = await browser.newPage();
try {
  for (const diagram of diagrams) {
    const pdf = await renderDiagramToPage(page, diagram);
    pages.push(pdf);
  }
} finally {
  await page.close();
  await closeBrowser(browser);
}
```

---

## Decision 2: Puppeteer Page Reuse Strategy

**Decision**: Fresh page content per diagram (reuse page object, replace HTML content)

**Rationale**:
- The POC uses `page.setContent(html, { waitUntil: "networkidle0" })` for each SVG.
- Creating a new page per diagram adds overhead (~50ms per page creation).
- Reusing the page object and replacing content is proven in the POC.
- `networkidle0` ensures fonts and resources are loaded before PDF generation.

**Alternatives Considered**:
1. **New page per diagram**: Cleaner isolation but ~50ms overhead per diagram. For 100 diagrams, that's 5 seconds of unnecessary delay.
2. **Tab pool**: Over-engineered for sequential processing.

**Implementation Pattern**:
```typescript
await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
await page.setContent(html, { waitUntil: "networkidle0" });
const pdfBytes = await page.pdf({ width, height, printBackground: true });
```

---

## Decision 3: PDF Assembly Approach

**Decision**: Render each diagram to individual PDF page, merge with pdf-lib

**Rationale**:
- This is exactly what the POC does and it works well.
- pdf-lib is already installed (dev dependency, will move to prod).
- Each diagram gets its own page with proper scaling.
- Merging PDFs with pdf-lib is ~10ms per page (from performance notes).

**Alternatives Considered**:
1. **Single HTML with page breaks, one Puppeteer render**: Complex page break handling, difficult to control individual diagram sizing.
2. **Hybrid SVG embedding**: Extra complexity with no clear benefit.

**Implementation Pattern**:
```typescript
import { PDFDocument } from "pdf-lib";

const finalPdf = await PDFDocument.create();
for (const pdfBytes of pageBuffers) {
  const tempDoc = await PDFDocument.load(pdfBytes);
  const [copiedPage] = await finalPdf.copyPages(tempDoc, [0]);
  finalPdf.addPage(copiedPage);
}
const finalBytes = await finalPdf.save();
```

---

## Decision 4: Memory Management for Large Decks

**Decision**: Buffer all pages in memory with input size limits (10MB total, 1MB per diagram, 100 diagrams max)

**Rationale**:
- At 100 diagrams with average 50KB per rendered PDF page, total memory is ~5MB.
- Maximum theoretical: 100 * 200KB = 20MB for page buffers, well within Node.js limits.
- The existing tools already enforce size limits; we apply the same pattern.
- Streaming to temp files adds complexity (file I/O, cleanup) for marginal benefit.

**Alternatives Considered**:
1. **Stream to temp files, merge at end**: More complex, requires temp file cleanup, not necessary at our scale.
2. **Lower limits (50 diagrams)**: Too restrictive; 100 is a reasonable upper bound based on performance testing estimates.

**Implementation Pattern**:
```typescript
// Validation at input
if (diagrams.length > MAX_DIAGRAMS) {
  return { error: { code: "INPUT_TOO_LARGE", message: "..." } };
}
const totalSize = diagrams.reduce((sum, d) => sum + Buffer.byteLength(d.code), 0);
if (totalSize > MAX_TOTAL_SIZE) {
  return { error: { code: "INPUT_TOO_LARGE", message: "..." } };
}
```

---

## Decision 5: Diagram Type Detection

**Decision**: Regex pattern matching on first non-empty, non-comment line

**Rationale**:
- Simple and fast - no external parsing needed.
- Covers all common Mermaid diagram types.
- Used for metadata only (not critical for rendering).
- Falls back to "unknown" if detection fails (acceptable per spec edge cases).

**Alternatives Considered**:
1. **Use Mermaid's internal parsing**: Requires instantiating Mermaid parser, adds dependency on internal APIs that may change.
2. **Full AST parsing**: Overkill for metadata purposes.

**Implementation Pattern**:
```typescript
const DIAGRAM_TYPE_PATTERNS: Record<string, RegExp> = {
  flowchart: /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i,
  sequence: /^sequenceDiagram/i,
  class: /^classDiagram/i,
  state: /^stateDiagram(-v2)?/i,
  er: /^erDiagram/i,
  journey: /^journey/i,
  gantt: /^gantt/i,
  pie: /^pie/i,
  mindmap: /^mindmap/i,
  timeline: /^timeline/i,
  quadrant: /^quadrantChart/i,
  git: /^gitGraph/i,
};

function detectDiagramType(code: string): string {
  const firstLine = code.trim().split('\n')[0].trim();
  for (const [type, pattern] of Object.entries(DIAGRAM_TYPE_PATTERNS)) {
    if (pattern.test(firstLine)) return type;
  }
  return "unknown";
}
```

---

## Decision 6: Timeout Budget Allocation

**Decision**: Global timeout (default 120s) with per-diagram timeout derived from remaining budget

**Rationale**:
- Consistent with existing single-diagram tools which use global timeout.
- Simple to implement: track elapsed time, abort if exceeded.
- Per-diagram complexity estimation is unreliable (diagram size doesn't correlate well with render time).
- SC-001 requires 10 pages in <30s, which gives ~3s per diagram on average.

**Alternatives Considered**:
1. **Equal time per diagram (total / count)**: Too restrictive for early diagrams if later ones are simple.
2. **Dynamic allocation based on complexity**: Unreliable complexity estimation, adds significant logic.

**Implementation Pattern**:
```typescript
const startTime = Date.now();
const timeout = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;

for (const diagram of diagrams) {
  const elapsed = Date.now() - startTime;
  const remaining = timeout - elapsed;
  if (remaining <= 0) {
    return { error: { code: "RENDER_TIMEOUT", message: "..." } };
  }
  // Use remaining time for next diagram
  await renderDiagram(diagram, remaining);
}
```

---

## Decision 7: Error Handling Strategy

**Decision**: Strict mode - fail fast on any diagram error

**Rationale**:
- FR-016 specifies strict error mode where any diagram failure fails the entire operation.
- Consistent with existing tool behavior.
- Provides clear, actionable errors with diagram index.
- Skip-failed mode can be added as future enhancement (currently out of scope).

**Alternatives Considered**:
1. **Collect all errors, fail after attempting all**: Wastes resources rendering after first failure.
2. **Skip failed diagrams, include in warnings**: Out of scope per FR-016.

**Implementation Pattern**:
```typescript
for (let i = 0; i < diagrams.length; i++) {
  const result = await renderDiagram(diagrams[i]);
  if ("error" in result) {
    return createError({
      ...result.error,
      details: { diagram_index: i, ...result.error.details }
    });
  }
}
```

---

## Decision 8: HTML Template for Pages

**Decision**: Minimal HTML template with flexbox centering and title support

**Rationale**:
- POC demonstrates the pattern: fixed dimensions, flexbox for centering, optional title.
- Consistent with existing font injection and styling patterns.
- Clean separation between SVG content and page layout.

**Implementation Pattern**:
```typescript
function createPageHtml(svg: string, title: string | undefined, showTitle: boolean): string {
  return `<!DOCTYPE html>
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
      padding: ${margin}px;
      background: ${background};
    }
    .title { font-size: 16px; margin-bottom: 16px; color: #333; flex-shrink: 0; }
    .diagram { flex: 1; display: flex; justify-content: center; align-items: center; width: 100%; overflow: hidden; }
    .diagram svg { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  ${showTitle && title ? `<div class="title">${escapeHtml(title)}</div>` : ''}
  <div class="diagram">${svg}</div>
</body>
</html>`;
}
```

---

## Dependencies Confirmed

| Dependency | Version | Status | Notes |
|------------|---------|--------|-------|
| pdf-lib | ^1.17.1 | Move to prod | Currently dev dep |
| puppeteer | ^23.11.1 | Existing | Browser management |
| @mermaid-js/mermaid-cli | ^11.12.0 | Existing | SVG rendering |
| @aws-sdk/client-s3 | ^3.962.0 | Existing | S3 storage |
| zod | ^4.3.4 | Existing | Schema validation |

---

## Performance Estimates (Validated from POC)

| Operation | Time | Notes |
|-----------|------|-------|
| Browser launch | ~500ms | Amortized across all diagrams |
| SVG render | 200-500ms | Per diagram, varies by complexity |
| PDF generation | ~100ms | Per page via Puppeteer |
| PDF merge | ~10ms | Per page via pdf-lib |
| S3 upload | 100-500ms | Depends on file size |

**10-diagram deck estimate**: 3-6 seconds (meets SC-001: <30s)

---

## Security Considerations (Validated)

1. **Input validation**: Max 100 diagrams, 10MB total, 1MB per diagram
2. **No user-controlled paths**: All file operations use UUIDs
3. **Timeout enforcement**: Global timeout prevents runaway processes
4. **Resource cleanup**: Browser always closed in finally block
5. **Mermaid security**: `securityLevel: "strict"` already enforced in renderer
