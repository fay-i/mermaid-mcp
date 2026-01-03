# PDF Deck Builder — Plan Prompt

Create an implementation plan for the PDF deck builder MCP tool.

## Key Architectural Decisions

1. Sequential vs parallel diagram rendering?
2. Puppeteer page reuse or fresh page per diagram?
3. HTML template approach vs direct PDF manipulation?
4. Memory management for large decks (streaming vs buffering)?
5. How to detect and report diagram types in response?
6. Timeout budget allocation across diagrams?

## Context

- The MCP server already renders individual diagrams via `mermaid_to_svg` and `mermaid_to_pdf`
- A proof-of-concept script (`scripts/combine-architecture-pdfs.mjs`) demonstrates the approach
- pdf-lib is already installed for PDF manipulation
- Puppeteer is already used for Mermaid rendering
- S3 storage infrastructure exists for artifact persistence

## Research Needed

- Puppeteer page reuse patterns for multiple renders
- pdf-lib performance characteristics with many pages
- Memory profiling for large diagram sets
- Mermaid diagram type detection (from parsed AST or heuristics)

## Design Questions

1. **Rendering Strategy**: How to render multiple diagrams efficiently?
   - Option A: Sequential rendering, reuse browser instance
   - Option B: Parallel rendering with concurrency limit (e.g., 4 at a time)
   - Option C: Worker pool for parallel rendering

2. **PDF Assembly**: How to combine rendered diagrams?
   - Option A: Render each SVG to individual PDF, merge with pdf-lib
   - Option B: Build single HTML with page breaks, render once with Puppeteer
   - Option C: Hybrid - render SVGs, embed in HTML, single PDF render

3. **Memory Management**: How to handle large decks?
   - Option A: Buffer all in memory (simple, limited scale)
   - Option B: Stream to temp files, merge at end
   - Option C: Set reasonable limits (e.g., max 50 diagrams)

4. **Timeout Strategy**: How to distribute timeout budget?
   - Option A: Equal time per diagram (total / count)
   - Option B: Dynamic allocation based on diagram complexity
   - Option C: Global timeout with early termination

5. **Error Handling**: How to handle partial failures?
   - Option A: Fail fast - any error stops entire operation
   - Option B: Collect all errors, fail after attempting all
   - Option C: Skip failed diagrams, include in warnings

6. **Diagram Type Detection**: How to identify diagram types?
   - Option A: Parse first line for diagram keyword (graph, sequenceDiagram, etc.)
   - Option B: Use Mermaid's internal parsing
   - Option C: Regex patterns for common diagram types

## Implementation Approach

Based on the proof-of-concept script, the recommended approach:

1. **Single Puppeteer browser instance** - launch once, reuse for all diagrams
2. **Sequential rendering** - simpler error handling, predictable memory usage
3. **HTML template per page** - consistent styling, easy title placement
4. **pdf-lib for assembly** - proven in POC, good performance
5. **Strict failure mode** - fail entire operation on any error (initial version)
6. **Simple type detection** - regex on first non-empty line

## Implementation Order

1. **Phase 1: Core Tool Structure**
   - Input/output schemas
   - Tool registration
   - Basic validation

2. **Phase 2: Diagram Rendering**
   - Browser lifecycle management
   - SVG rendering loop
   - Page HTML template

3. **Phase 3: PDF Assembly**
   - Puppeteer PDF generation per page
   - pdf-lib page combination
   - S3 storage integration

4. **Phase 4: Enhanced Features**
   - Page size options
   - Orientation support
   - Title rendering
   - Margin configuration

5. **Phase 5: Response Enrichment**
   - Diagram type detection
   - Page metadata collection
   - CDN URL inclusion

## Dependencies

- Existing: Puppeteer (Mermaid rendering)
- Existing: pdf-lib (PDF manipulation)
- Existing: S3 storage infrastructure
- Existing: Render function from `src/renderer/`
- Reference: `scripts/combine-architecture-pdfs.mjs` (POC)

## Performance Considerations

- Browser startup: ~500ms (amortized across all diagrams)
- SVG render: ~200-500ms per diagram (varies by complexity)
- PDF generation: ~100ms per page
- PDF merge: ~10ms per page
- S3 upload: ~100-500ms depending on size

Estimated total for 10 diagrams: 3-6 seconds

## Security Considerations

- Input validation to prevent resource exhaustion
- Diagram count limits (max 100)
- Total input size limits (max 10MB)
- Timeout enforcement to prevent runaway processes
- No user-controlled file paths or URLs

## Testing Strategy

- Unit tests for schema validation
- Unit tests for diagram type detection
- Integration tests for end-to-end rendering
- Performance tests for large decks (50+ diagrams)
- Error handling tests for various failure modes
