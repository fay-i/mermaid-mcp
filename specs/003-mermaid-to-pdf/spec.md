# Feature Specification: Mermaid to PDF Tool

**Feature Branch**: `003-mermaid-to-pdf`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "I want to add a new mermaid_to_pdf tool to this MCP project. It should leverage the mermaid_to_svg implementation to create vector pdf renderings."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate PDF from Mermaid Diagram (Priority: P1)

A developer using an AI coding assistant wants to generate a PDF document containing a Mermaid diagram. They provide the Mermaid diagram source code to the MCP tool and receive a PDF file that preserves the vector quality of the diagram for printing or sharing.

**Why this priority**: This is the core functionality that enables all other use cases. Without the ability to generate a PDF from Mermaid source, no other features matter.

**Independent Test**: Can be fully tested by providing valid Mermaid diagram code and verifying a valid PDF is returned that contains the rendered diagram as vector graphics.

**Acceptance Scenarios**:

1. **Given** valid Mermaid flowchart code, **When** calling mermaid_to_pdf with the code, **Then** a valid PDF document is returned containing the diagram with vector graphics preserved
2. **Given** valid Mermaid sequence diagram code, **When** calling mermaid_to_pdf, **Then** a valid PDF is returned that renders correctly when viewed in a PDF reader
3. **Given** Mermaid code with a specified theme (dark/forest/neutral), **When** calling mermaid_to_pdf with the theme option, **Then** the PDF reflects the chosen theme colors

---

### User Story 2 - Handle Invalid Input Gracefully (Priority: P2)

A developer accidentally provides invalid or malformed Mermaid syntax. The tool should return clear, actionable error messages that help them fix the problem rather than cryptic failures.

**Why this priority**: Error handling is essential for a good developer experience. Users need to understand what went wrong to fix their diagrams.

**Independent Test**: Can be tested by providing various types of invalid input and verifying appropriate error codes and messages are returned.

**Acceptance Scenarios**:

1. **Given** empty or missing Mermaid code, **When** calling mermaid_to_pdf, **Then** an error is returned with code indicating invalid input
2. **Given** syntactically invalid Mermaid code, **When** calling mermaid_to_pdf, **Then** an error is returned with a parse error code and message describing the syntax issue
3. **Given** Mermaid code that exceeds size limits, **When** calling mermaid_to_pdf, **Then** an error is returned indicating the input is too large

---

### User Story 3 - Timeout Protection (Priority: P3)

A developer provides an extremely complex diagram that would take too long to render. The tool should enforce time limits and clean up resources properly rather than hanging indefinitely.

**Why this priority**: Resource management prevents the tool from blocking other operations and ensures predictable behavior in production environments.

**Independent Test**: Can be tested by providing complex diagrams with short timeouts and verifying the tool returns a timeout error within the specified time.

**Acceptance Scenarios**:

1. **Given** a complex diagram and a short timeout value, **When** the rendering exceeds the timeout, **Then** the operation is cancelled and a timeout error is returned
2. **Given** a rendering that times out, **When** the error is returned, **Then** all rendering resources are properly cleaned up

---

### Edge Cases

- **Unsupported diagram types**: Delegate to SVG renderer; pass through its error response (consistent behavior with mermaid_to_svg)
- **Special characters / Unicode**: No special handling required; SVG and PDF natively support Unicode throughout the pipeline
- **PDF generation failure**: Return distinct error code `PDF_GENERATION_FAILED` with details from conversion library (distinguishes from SVG rendering failures)
- **Malformed config JSON**: Validate JSON upfront; return `INVALID_CONFIG` error with parse details (fail fast)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept Mermaid diagram source code as input and return a PDF document
- **FR-002**: System MUST produce vector-quality PDF output (not rasterized images)
- **FR-003**: System MUST support the same diagram types as the existing mermaid_to_svg tool (flowcharts, sequence diagrams, class diagrams, state diagrams, etc.)
- **FR-004**: System MUST support theme selection (default, dark, forest, neutral)
- **FR-005**: System MUST support optional background color configuration
- **FR-006**: System MUST support optional Mermaid configuration via JSON
- **FR-007**: System MUST enforce configurable timeout limits with proper resource cleanup
- **FR-008**: System MUST return structured error responses with stable error codes for all failure modes, including `PDF_GENERATION_FAILED` for SVG-to-PDF conversion failures
- **FR-009**: System MUST validate input size and reject oversized inputs with appropriate errors
- **FR-010**: System MUST generate a unique request ID for each operation for traceability
- **FR-011**: System MUST leverage the existing SVG rendering pipeline as an intermediate step

### Key Entities

- **MermaidSource**: The input diagram code, with constraints on size and required presence
- **PDFDocument**: The output artifact, containing vector graphics representation of the diagram
- **RenderOptions**: Optional settings including theme, background color, custom Mermaid config, and timeout (matches existing SVG tool naming)
- **RenderResult**: Discriminated response containing either success (PDF data) or error information. Success fields: `pdf_base64` (base64-encoded PDF), `request_id` (unique identifier), `metadata` (dimensions, generation time)
- **RenderError**: Structured error with code, message, and optional details

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a PDF from any valid Mermaid diagram that the existing SVG tool supports
- **SC-002**: Generated PDFs maintain vector quality when zoomed to 400% in standard PDF readers (automated tests verify by checking for PDF stream operators like `re`, `m`, `l`, `c` rather than rasterized image data)
- **SC-003**: Tool responds with success or error within the configured timeout period (default 30 seconds)
- **SC-004**: All error conditions return structured responses with one of the defined error codes
- **SC-005**: The tool maintains consistent behavior with the existing mermaid_to_svg tool for shared parameters (theme, background, config, timeout)

## Assumptions

- The existing mermaid_to_svg rendering pipeline is stable and can be used as the foundation for PDF generation
- PDF output will be returned as base64-encoded data (consistent with common MCP patterns for binary data)
- The same size limits and timeout bounds from mermaid_to_svg apply (1MB max input, 1-120 second timeout range)
- Users understand that PDF generation may take slightly longer than SVG generation due to the additional conversion step
- SVG-to-PDF conversion uses Puppeteer's native `page.pdf()` to avoid ESM compatibility issues with jsPDF (see research.md) and leverage existing dependencies
- **Primary consumers are AI assistants** (MCP clients); error messages and responses should be optimized for machine parsing and LLM comprehension (structured, unambiguous, actionable)

## Out of Scope

- Multi-page PDF documents (each diagram produces a single page)
- PDF metadata editing (title, author, etc.)
- PDF password protection or encryption
- Batch processing of multiple diagrams into one PDF
- Custom page sizes or orientations (output will match diagram dimensions)

## Clarifications

### Session 2026-01-02

- Q: What SVG-to-PDF conversion method should be used? → A: Puppeteer's native `page.pdf()` (jsPDF has ESM compatibility issues per research.md)
- Q: How should the tool handle unsupported Mermaid diagram types? → A: Delegate to SVG renderer; pass through its error
- Q: What error code for PDF generation failure after successful SVG? → A: Distinct `PDF_GENERATION_FAILED` code with conversion details
- Q: How to handle malformed config JSON? → A: Validate upfront; return `INVALID_CONFIG` with parse details; optimize errors for AI assistant consumers
- Q: How to handle special characters / Unicode content? → A: No special handling; natively supported throughout pipeline
