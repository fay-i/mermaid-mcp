# Research: Mermaid to PDF Tool

**Date**: 2026-01-02
**Feature**: 003-mermaid-to-pdf
**Status**: Complete

## Research Questions

### Q1: What is the best approach for SVG-to-PDF conversion?

**Decision**: Use Puppeteer's native `page.pdf()` directly after rendering the Mermaid diagram to inline SVG.

**Rationale**:
- We already have a working Puppeteer-based rendering pipeline for `mermaid_to_svg`
- Puppeteer renders the page in headless Chromium and prints it to PDF, preserving SVG vector graphics
- Chrome's PDF printing engine maintains vector data for inline SVGs
- This approach requires no additional dependencies (jspdf, svg2pdf.js)
- Single browser instance can render both SVG and PDF in sequence

**Alternatives Considered**:

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| jspdf + svg2pdf.js | Pure JS, widely used | ESM issues with Node.js ([#3835](https://github.com/parallax/jsPDF/issues/3835)), requires JSDOM, potential rendering differences | Added complexity, ESM compatibility concerns, extra dependencies |
| svg2pdf (Inkscape-based) | High fidelity | Requires native Inkscape installation | Violates portability requirement from spec |
| ConvertAPI/Aspose | High quality | External API dependency, cost | Violates self-contained requirement |

**Sources**:
- [jsPDF GitHub Issue #3835](https://github.com/parallax/jsPDF/issues/3835) - ESM compatibility issues
- [svg2pdf.js GitHub](https://github.com/yWorks/svg2pdf.js) - Browser-focused library
- [Puppeteer PDF Generation Guide](https://pptr.dev/guides/pdf-generation)
- [Puppeteer SVG Issue #2556](https://github.com/puppeteer/puppeteer/issues/2556) - Inline SVGs work, external files may not

### Q2: How do we ensure vector quality in the PDF output?

**Decision**: Render the Mermaid diagram as inline SVG in an HTML page, then use `page.pdf()` with appropriate settings.

**Rationale**:
- Chrome's PDF engine preserves vector paths when SVG is inlined in HTML
- External SVG references may fail to render (known Puppeteer issue)
- Our existing renderer already produces inline SVG

**Implementation Approach**:
1. Render Mermaid → SVG using existing `render()` function
2. Embed SVG in minimal HTML document
3. Load HTML in Puppeteer page
4. Call `page.pdf()` with format matching SVG viewBox dimensions
5. Return PDF as base64-encoded data

**Puppeteer PDF Configuration**:
```typescript
const pdfBuffer = await page.pdf({
  printBackground: true,  // Include diagram background
  width: svgWidth,        // Match SVG dimensions
  height: svgHeight,      // Match SVG dimensions
  pageRanges: '1',        // Single page
  scale: 1,               // No scaling
});
```

### Q3: How do we handle the timeout budget between SVG and PDF phases?

**Decision**: Split the configured timeout between SVG rendering and PDF generation phases.

**Rationale**:
- SVG rendering is typically slower than PDF conversion
- PDF generation via `page.pdf()` is fast (< 1 second typically)
- Reserve 80% of timeout for SVG, 20% for PDF

**Implementation**:
```typescript
const svgTimeoutMs = Math.floor(timeoutMs * 0.8);
const pdfTimeoutMs = Math.floor(timeoutMs * 0.2);
```

### Q4: What new error code is needed for PDF-specific failures?

**Decision**: Add `PDF_GENERATION_FAILED` error code as specified in the feature spec.

**Rationale**:
- Distinguishes PDF conversion failures from SVG rendering failures
- Allows AI assistants to provide targeted error guidance
- Maintains consistency with spec requirements (FR-008)

**Error Taxonomy**:
| Error Code | When Used |
|-----------|-----------|
| All existing SVG errors | Inherited from mermaid_to_svg (INVALID_INPUT, PARSE_ERROR, etc.) |
| PDF_GENERATION_FAILED | SVG rendered successfully but PDF conversion failed |

### Q5: Do we need new dependencies?

**Decision**: No new dependencies required.

**Rationale**:
- Puppeteer is already installed and used for SVG rendering
- `page.pdf()` is built into Puppeteer
- We can reuse the existing browser lifecycle management

**Benefit**:
- Smaller bundle size
- No ESM compatibility issues
- Consistent rendering engine (Chrome)

### Q6: How do we validate PDF output is vector-quality?

**Decision**: Validate PDF contains vector paths, not rasterized images.

**Test Strategy**:
1. **File signature**: Verify PDF magic bytes `%PDF-`
2. **Content stream**: Check for vector operators (`m`, `l`, `c` for paths) rather than image XObjects
3. **Visual verification**: Manual spot-check during development

**Implementation**: Parse PDF header and sample content in tests:
```typescript
// PDF starts with magic bytes
expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');

// Check for vector path operators in content
const pdfContent = pdfBuffer.toString('latin1');
expect(pdfContent).toMatch(/\d+ \d+ m/); // moveto
expect(pdfContent).toMatch(/\d+ \d+ l/); // lineto
```

## Architecture Decision

```
┌─────────────────────────────────────────────────────────────┐
│                    mermaid_to_pdf Tool                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input Validation          Same as mermaid_to_svg           │
│  ─────────────────         ───────────────────              │
│  • code presence           • Reuse validateInput()          │
│  • size limits             • Reuse validateTimeout()        │
│  • timeout bounds          • Reuse parseConfigJson()        │
│  • config JSON                                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SVG Rendering             Existing Pipeline                │
│  ─────────────             ─────────────────                │
│  • launchBrowser()         • Already tested                 │
│  • render() → SVG          • Deterministic                  │
│  • closeBrowser()          • Handles cleanup                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PDF Conversion            NEW (this feature)               │
│  ──────────────            ─────────────────                │
│  • Embed SVG in HTML       • Uses same browser instance     │
│  • page.pdf()              • Puppeteer native               │
│  • Return base64           • MCP pattern                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Notes

1. **Browser Reuse**: Render SVG and PDF in same browser session to avoid launch overhead
2. **Page Lifecycle**: Create new page for PDF, close after use
3. **Dimension Extraction**: Parse SVG viewBox or width/height attributes
4. **Base64 Encoding**: Use `buffer.toString('base64')` for MCP transport
5. **Cleanup**: Ensure page.close() and browser.close() on all paths

## Open Questions (None)

All clarifications resolved. Ready for Phase 1.
