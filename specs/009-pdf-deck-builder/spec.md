# Feature Specification: PDF Deck Builder

**Feature Branch**: `009-pdf-deck-builder`
**Created**: 2026-01-03
**Status**: Draft
**Input**: User description: "Add an MCP tool that generates a multi-page PDF deck from multiple Mermaid diagrams, with each diagram scaled to fill a standard page"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Multi-Diagram PDF Deck (Priority: P1)

A user needs to create documentation or a presentation containing multiple related Mermaid diagrams. They invoke the `mermaid_to_deck` tool with an array of Mermaid diagram sources, and receive a single PDF with each diagram on its own page, consistently sized and scaled.

**Why this priority**: This is the core value proposition - combining multiple diagrams into a cohesive document is the primary reason this tool exists.

**Independent Test**: Can be fully tested by calling the tool with 2+ valid Mermaid diagrams and verifying the output is a downloadable multi-page PDF with correct page count.

**Acceptance Scenarios**:

1. **Given** 3 valid Mermaid diagrams, **When** user invokes `mermaid_to_deck` with default options, **Then** a PDF with 3 pages is generated, each page containing one diagram scaled to fit the page.
2. **Given** diagrams of varying complexity (simple flowchart, complex sequence diagram), **When** user generates a deck, **Then** all diagrams are rendered correctly with consistent page dimensions.
3. **Given** a successful deck generation, **When** the response is returned, **Then** it includes download URL, page count, and per-page metadata (index, title, diagram type).

---

### User Story 2 - Configure Page Layout and Formatting (Priority: P2)

A user needs control over the output format to match their presentation or documentation standards. They specify page size, orientation, margins, and whether to show titles.

**Why this priority**: Customization is important for professional output, but the tool delivers value with sensible defaults. This extends the core functionality.

**Independent Test**: Can be tested by generating the same diagrams with different layout options and verifying the output PDF reflects those choices.

**Acceptance Scenarios**:

1. **Given** a deck request with `page_size: "a4"` and `orientation: "portrait"`, **When** the deck is generated, **Then** all pages use A4 portrait dimensions.
2. **Given** diagrams with titles and `show_titles: true`, **When** the deck is generated, **Then** each page displays the diagram's title.
3. **Given** custom margins (top: 72, right: 72, bottom: 72, left: 72), **When** the deck is generated, **Then** diagrams are positioned with the specified margins.

---

### User Story 3 - Handle Errors Gracefully (Priority: P2)

A user submits a deck request where one or more diagrams contain syntax errors or the request exceeds limits. The system provides clear, actionable error information identifying which diagram(s) failed and why.

**Why this priority**: Error handling is essential for a good user experience, especially when dealing with multiple inputs where partial failures are likely.

**Independent Test**: Can be tested by submitting intentionally invalid diagrams and verifying error responses contain specific diagram indices and error details.

**Acceptance Scenarios**:

1. **Given** a request with one invalid Mermaid diagram among valid ones, **When** strict mode is active (default), **Then** the entire operation fails with an error identifying the invalid diagram by index.
2. **Given** an empty diagrams array, **When** user invokes `mermaid_to_deck`, **Then** an error with code `INVALID_INPUT` is returned.
3. **Given** a request exceeding the 100-diagram limit, **When** user invokes `mermaid_to_deck`, **Then** an error with code `INPUT_TOO_LARGE` is returned.
4. **Given** a request that times out, **When** the timeout is reached, **Then** an error with code `RENDER_TIMEOUT` is returned and resources are cleaned up.

---

### User Story 4 - Access Generated Deck via Multiple URLs (Priority: P3)

A user generates a deck and needs to share or download it. The system provides both a presigned S3 URL (direct storage access) and a CDN URL (when configured) for optimized delivery.

**Why this priority**: URL access is necessary but builds on existing infrastructure patterns already in the codebase.

**Independent Test**: Can be tested by generating a deck and verifying both URLs are present in the response and resolve to the same PDF content.

**Acceptance Scenarios**:

1. **Given** a successful deck generation, **When** the response is returned, **Then** it includes a presigned `download_url` for direct S3 access.
2. **Given** CDN proxy is configured, **When** a deck is generated, **Then** the response includes both `download_url` and `cdn_url`.
3. **Given** a valid download URL, **When** the user downloads the file, **Then** they receive a valid PDF with the expected page count.

---

### Edge Cases

- What happens when a user submits exactly 1 diagram? The deck is generated with a single page.
- What happens when a user submits exactly 100 diagrams? The deck is generated successfully at the limit.
- What happens when a user submits 101 diagrams? The request is rejected with `INPUT_TOO_LARGE`.
- What happens when total input size exceeds 10MB? The request is rejected with `INPUT_TOO_LARGE`.
- What happens when individual diagram code exceeds 1MB? The request is rejected with `INPUT_TOO_LARGE` for that diagram.
- What happens when a diagram renders successfully but PDF assembly fails? Error `PDF_GENERATION_FAILED` is returned.
- What happens when S3 storage is unavailable? Error `STORAGE_FAILED` is returned.
- What happens when diagram type cannot be detected? The diagram type is reported as "unknown" in page metadata.
- What happens when the browser/renderer crashes or fails? Error `RENDER_FAILED` is returned with a details field distinguishing crash, timeout, or parse failure.

## Out of Scope

The following capabilities are explicitly **not included** in this feature:

- **Diagram editing**: The tool renders diagrams as provided; no in-tool editing or syntax correction.

The following are **deferred for future enhancement** (not blocked, but not in initial implementation):

- Table of contents generation
- Page numbering
- Custom headers/footers

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept an array of 1 to 100 Mermaid diagram objects, each with required `code` and optional `title` fields.
- **FR-002**: System MUST render each diagram to SVG using the existing rendering infrastructure.
- **FR-003**: System MUST combine rendered SVGs into a single multi-page PDF document.
- **FR-004**: System MUST scale each diagram to fit the page while maintaining aspect ratio.
- **FR-005**: System MUST support configurable page sizes: letter (612x792 points), A4 (595x842 points), and legal (612x1008 points).
- **FR-006**: System MUST support both landscape and portrait orientations, defaulting to landscape.
- **FR-007**: System MUST support optional per-page titles that display when `show_titles` is enabled.
- **FR-008**: System MUST support configurable page margins with default of 36 points on all sides.
- **FR-009**: System MUST store the generated PDF in S3 storage.
- **FR-010**: System MUST return a presigned download URL for the generated PDF.
- **FR-011**: System MUST return a CDN URL when CDN proxy is configured.
- **FR-012**: System MUST include page metadata in the response (index, title, diagram type for each page).
- **FR-013**: System MUST enforce a maximum total input size of 10MB.
- **FR-014**: System MUST enforce a maximum individual diagram code size of 1MB.
- **FR-015**: System MUST support a configurable timeout (default 120 seconds) that applies to the entire operation.
- **FR-016**: System MUST use strict error mode where any diagram failure causes the entire operation to fail.
- **FR-017**: System MUST return detailed error information including error code, message, and diagram-specific details (index, line number when applicable).
- **FR-018**: System MUST clean up resources (temporary files, browser instances) on timeout or error.
- **FR-019**: System MUST support Mermaid theme configuration (default, dark, forest, neutral).
- **FR-020**: System MUST support configurable background color with default white (#ffffff).
- **FR-021**: System MUST emit structured log entries (console) with correlation IDs for request tracing and debugging.
- **FR-022**: System MUST retain generated PDFs for 1 hour (session-scoped), following existing cache patterns; presigned URLs MUST expire within this window.

### Key Entities

- **Deck Request**: A request to generate a multi-page PDF containing multiple Mermaid diagrams with layout options.
- **Diagram**: An individual Mermaid diagram with source code and optional title; becomes one page in the deck.
- **Deck Response**: The result of a successful generation, containing URLs, page count, and per-page metadata.
- **Page Metadata**: Information about each page in the generated deck (index, title, detected diagram type).
- **Error Response**: Structured error information when generation fails, including error code and diagram-specific details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a 10-page deck in under 60 seconds under normal conditions (warm browser instance, S3 latency <500ms, no concurrent rendering operations).
- **SC-002**: Generated PDF pages maintain consistent dimensions across all diagrams regardless of source diagram complexity.
- **SC-003**: 100% of valid Mermaid diagrams that render successfully as individual diagrams also render correctly in deck format.
- **SC-004**: Error responses identify the specific failing diagram(s) with actionable information in 100% of failure cases.
- **SC-005**: Users can download generated decks via provided URLs within 1 hour of generation (presigned URL validity matches session-scoped retention).
- **SC-006**: System handles the maximum load (100 diagrams, 10MB total input) without crashing or corrupting output.

## Clarifications

### Session 2026-01-03

- Q: What observability approach should be used? → A: Structured logging (console) with correlation IDs for request tracing
- Q: How long are generated PDFs retained? → A: Session-scoped (1 hour), following existing cache patterns in codebase
- Q: How should concurrent requests be handled? → A: No server-side concurrency control; single request processing with MCP client managing queuing
- Q: What is explicitly out-of-scope? → A: Diagram editing only; page numbering and TOC are allowed as future enhancements
- Q: How should browser/renderer failures be reported? → A: Single `RENDER_FAILED` error code with details field containing crash/timeout/parse distinction

## Assumptions

- The existing Mermaid rendering infrastructure (`render()` function) is stable and reusable.
- S3-compatible storage is configured and accessible.
- The pdf-lib library (already installed) is suitable for PDF page assembly.
- Puppeteer is available for HTML-to-PDF rendering with styling.
- CDN proxy configuration follows existing patterns in the codebase.
- Per-diagram timeout is not needed; the global timeout is sufficient for initial implementation.
- Font rendering uses Google Fonts with "Source Code Pro" as the default font, following existing patterns in single-diagram tools. Falls back to system monospace if Google Fonts unavailable.
- Drop shadow support follows existing patterns from single-diagram tools.
- Concurrency control is handled by the MCP client/orchestrator, not the tool itself; each request is processed independently.
