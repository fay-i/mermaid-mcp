# PDF Deck Builder — Specify Prompt

Feature: PDF Deck Builder

Add an MCP tool that generates a multi-page PDF "deck" from multiple Mermaid diagrams, with each diagram scaled to fill a standard page.

## Problem

Currently, the MCP server can render individual Mermaid diagrams to SVG or PDF. However:

1. Users often need to create documentation or presentations with multiple related diagrams
2. Each diagram renders to its own file, requiring manual combination
3. PDF page sizes are determined by SVG dimensions, leading to inconsistent sizing
4. There's no way to create a cohesive multi-page document from a set of diagrams

## Solution

1. Add a new MCP tool `mermaid_to_deck` that accepts multiple Mermaid diagram sources
2. Render each diagram to SVG, then combine into a single multi-page PDF
3. Each diagram fills a standard page size (configurable: letter, A4, etc.)
4. Support both portrait and landscape orientations
5. Optional: Add titles/headers to each page
6. Store the combined PDF in S3 and return download URL

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │────▶│   Deck Builder  │────▶│   S3 Storage    │
│                 │     │   (Puppeteer)   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │ For each diagram:
        │                       │ 1. Render Mermaid → SVG
        │                       │ 2. Scale to page size
        │                       │ 3. Add to PDF document
        │                       │
        ▼                       ▼
   mermaid_to_deck         Multi-page PDF
   tool invocation         with consistent sizing
```

## Key Behaviors

- Accepts array of Mermaid diagram sources with optional per-diagram metadata
- Renders each diagram to SVG using existing renderer
- Combines SVGs into single multi-page PDF using Puppeteer/pdf-lib
- Each page uses consistent dimensions (default: Letter Landscape 11"×8.5")
- Diagrams scaled to fit page while maintaining aspect ratio
- Optional title per page (from metadata or auto-generated)
- Stores combined PDF in S3
- Returns presigned download URL and CDN URL (if configured)

## API: mermaid_to_deck Tool

### Input Schema

```json
{
  "diagrams": [
    {
      "code": "graph TD\n  A --> B",
      "title": "Optional Page Title"
    },
    {
      "code": "sequenceDiagram\n  A->>B: Hello"
    }
  ],
  "options": {
    "page_size": "letter",
    "orientation": "landscape",
    "theme": "default",
    "background": "#ffffff",
    "show_titles": true,
    "title_font_size": 16,
    "margins": {
      "top": 36,
      "right": 36,
      "bottom": 36,
      "left": 36
    }
  },
  "timeout_ms": 120000
}
```

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `diagrams` | array | Yes | - | Array of diagram objects |
| `diagrams[].code` | string | Yes | - | Mermaid diagram source code |
| `diagrams[].title` | string | No | - | Optional title for this page |
| `options.page_size` | enum | No | `"letter"` | Page size: `"letter"`, `"a4"`, `"legal"` |
| `options.orientation` | enum | No | `"landscape"` | `"landscape"` or `"portrait"` |
| `options.theme` | enum | No | `"default"` | Mermaid theme |
| `options.background` | string | No | `"#ffffff"` | Background color |
| `options.show_titles` | boolean | No | `true` | Show page titles |
| `options.title_font_size` | number | No | `16` | Title font size in points |
| `options.margins` | object | No | `{top:36,right:36,bottom:36,left:36}` | Page margins in points |
| `timeout_ms` | number | No | `120000` | Total timeout for all diagrams |

### Output Schema (Success)

```json
{
  "ok": true,
  "request_id": "uuid",
  "artifact_id": "uuid",
  "download_url": "https://minio.example.com/...",
  "cdn_url": "http://mermaid-cdn.local:8100/artifact/uuid.pdf",
  "curl_command": "curl -o deck.pdf 'https://...'",
  "page_count": 10,
  "content_type": "application/pdf",
  "size_bytes": 721085,
  "pages": [
    { "index": 0, "title": "System Overview", "diagram_type": "flowchart" },
    { "index": 1, "title": "Sequence Diagram", "diagram_type": "sequence" }
  ],
  "warnings": [],
  "errors": []
}
```

### Output Schema (Error)

```json
{
  "ok": false,
  "request_id": "uuid",
  "warnings": [],
  "errors": [
    {
      "code": "PARSE_ERROR",
      "message": "Mermaid syntax error in diagram 3",
      "details": { "diagram_index": 2, "line": 5 }
    }
  ]
}
```

## Page Sizes (in points at 72dpi)

| Size | Portrait (W×H) | Landscape (W×H) |
|------|----------------|-----------------|
| `letter` | 612×792 | 792×612 |
| `a4` | 595×842 | 842×595 |
| `legal` | 612×1008 | 1008×612 |

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Empty diagrams array or invalid structure |
| `INPUT_TOO_LARGE` | Total input exceeds size limit |
| `PARSE_ERROR` | Mermaid syntax error in one or more diagrams |
| `RENDER_FAILED` | Diagram rendering failed |
| `RENDER_TIMEOUT` | Rendering exceeded timeout |
| `PDF_GENERATION_FAILED` | Failed to combine into PDF |
| `STORAGE_FAILED` | Failed to store in S3 |

## Partial Failure Handling

When some diagrams fail but others succeed:

1. **Strict Mode (default)**: Fail entire operation if any diagram fails
2. **Lenient Mode** (future): Generate PDF with successful diagrams, report failures in warnings

Initial implementation uses strict mode only.

## Constraints

- Minimum 1 diagram, maximum 100 diagrams per deck
- Individual diagram code size limit: 1MB (same as single diagram tools)
- Total input size limit: 10MB
- Timeout applies to entire operation, not per-diagram
- Memory usage scales with diagram count (consider streaming for large decks)

## Acceptance Criteria

1. Tool accepts array of Mermaid diagrams and produces multi-page PDF
2. Each diagram scaled to fill page while maintaining aspect ratio
3. Consistent page size across all pages (configurable)
4. Support for landscape and portrait orientations
5. Optional titles displayed on each page
6. PDF stored in S3 with presigned URL returned
7. CDN URL included when CDN proxy is configured
8. Detailed page metadata in response (titles, diagram types)
9. Graceful error handling with diagram-specific error details
10. Timeout enforcement for entire operation

## Implementation Notes

- Reuse existing `render()` function for SVG generation
- Use pdf-lib for PDF page assembly (already installed)
- Puppeteer for HTML→PDF rendering of styled pages
- Consider parallel rendering for performance (with concurrency limit)
- Page styling via HTML template (similar to combine-architecture-pdfs.mjs script)
- Leverage existing S3 storage infrastructure
