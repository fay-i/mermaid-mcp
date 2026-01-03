# PDF Deck Builder — Tasks Prompt

Generate tasks for implementing the PDF deck builder MCP tool.

## Phase 1: Schema & Validation

- Define `MermaidToDeckInputSchema` with Zod
  - `diagrams` array with `code` and optional `title`
  - `options` object with page settings
  - `timeout_ms` with min/max bounds
- Define `MermaidToDeckOutputSchema` (success/error discriminated union)
- Define `PageMetadata` type for response enrichment
- Implement input validation
  - Minimum 1 diagram
  - Maximum 100 diagrams
  - Individual code size limit (1MB)
  - Total input size limit (10MB)
- Unit tests for schema validation
- Unit tests for size limit enforcement

## Phase 2: Core Rendering Infrastructure

- Create `src/tools/mermaid-to-deck.ts` tool file
- Implement browser lifecycle management
  - Launch browser once per tool invocation
  - Cleanup on success or failure
- Create HTML page template function
  - Accepts SVG content and optional title
  - Configurable page dimensions
  - Configurable margins
  - Centered diagram with max-width/max-height scaling
- Implement SVG rendering loop
  - Iterate through diagrams array
  - Call existing `render()` function for each
  - Collect rendered SVGs
- Implement timeout budget allocation
  - Total timeout divided among diagrams
  - Reserve time for PDF assembly
- Unit tests for HTML template generation
- Unit tests for timeout allocation

## Phase 3: PDF Generation & Assembly

- Implement single-page PDF rendering
  - Set Puppeteer page content to HTML template
  - Render to PDF with exact page dimensions
- Implement multi-page PDF assembly with pdf-lib
  - Create new PDF document
  - Copy pages from individual renders
  - Combine into single document
- Implement page size configuration
  - Letter (default): 792×612 landscape
  - A4: 842×595 landscape
  - Legal: 1008×612 landscape
- Implement orientation support
  - Landscape (default): width > height
  - Portrait: height > width
- Unit tests for PDF generation
- Unit tests for page size calculations

## Phase 4: Storage Integration

- Integrate with existing S3 storage
  - Reuse `S3Storage.storeArtifact()` method
  - Generate presigned download URL
- Add CDN URL to response (when configured)
  - Check `MERMAID_CDN_BASE_URL` environment variable
  - Build CDN URL from artifact ID
- Generate curl command for download
- Unit tests for storage integration

## Phase 5: Response Enrichment

- Implement diagram type detection
  - Parse first non-empty, non-directive line
  - Match against known diagram keywords
  - Return detected type or "unknown"
- Collect page metadata
  - Page index (0-based)
  - Title (from input or auto-generated)
  - Detected diagram type
- Include metadata array in success response
- Unit tests for type detection
- Unit tests for metadata collection

## Phase 6: Error Handling

- Implement error mapping
  - Mermaid parse errors → `PARSE_ERROR` with diagram index
  - Render failures → `RENDER_FAILED` with diagram index
  - Timeout → `RENDER_TIMEOUT`
  - PDF generation → `PDF_GENERATION_FAILED`
  - S3 failures → `STORAGE_FAILED`
- Implement strict failure mode
  - Any diagram failure stops entire operation
  - Return first error encountered
- Implement cleanup on failure
  - Close browser
  - No partial artifacts stored
- Unit tests for each error path
- Integration tests for failure scenarios

## Phase 7: Tool Registration

- Register `mermaid_to_deck` tool in MCP server
- Add tool description and input schema to tool listing
- Verify tool appears in `tools/list` response
- Integration test for tool discovery
- Integration test for end-to-end flow

## Phase 8: Documentation & Polish

- Add tool documentation to README
- Add usage examples
- Performance testing with various deck sizes
- Memory profiling for large decks
- Update CLAUDE.md with new tool info

## Task Dependencies

```
Phase 1 (Schema)
    │
    ▼
Phase 2 (Rendering Infrastructure)
    │
    ▼
Phase 3 (PDF Generation)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 4 (Storage)   Phase 5 (Metadata)
    │                  │
    └────────┬─────────┘
             ▼
      Phase 6 (Error Handling)
             │
             ▼
      Phase 7 (Registration)
             │
             ▼
      Phase 8 (Documentation)
```

## Acceptance Tests

Each phase should include tests verifying:

- **Phase 1**: Invalid inputs rejected, valid inputs pass schema
- **Phase 2**: SVGs rendered for each diagram, HTML template valid
- **Phase 3**: Multi-page PDF generated with correct dimensions
- **Phase 4**: PDF stored in S3, URLs returned correctly
- **Phase 5**: Diagram types detected, metadata included
- **Phase 6**: Errors mapped correctly, cleanup performed
- **Phase 7**: Tool discoverable and invocable via MCP
- **Phase 8**: Documentation complete, performance acceptable

## User Stories

### US1: Basic Deck Generation
As an MCP client, I can submit multiple Mermaid diagrams and receive a single PDF with each diagram on its own page.

### US2: Page Configuration
As a user, I can specify page size (letter, A4) and orientation (landscape, portrait) for the output PDF.

### US3: Titled Pages
As a user, I can optionally provide titles for each diagram page that appear in the PDF.

### US4: Download Access
As a user, I receive a presigned S3 URL and CDN URL for downloading the generated PDF.

### US5: Error Reporting
As a user, when a diagram fails to render, I receive a clear error indicating which diagram failed and why.

### US6: Page Metadata
As a developer, the response includes metadata about each page (index, title, diagram type) for programmatic use.

## Reference Implementation

See `scripts/combine-architecture-pdfs.mjs` for proof-of-concept implementation demonstrating:
- Browser management
- HTML template structure
- pdf-lib page assembly
- Page sizing and scaling
