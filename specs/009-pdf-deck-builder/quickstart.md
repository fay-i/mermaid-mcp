# Quickstart: PDF Deck Builder

**Date**: 2026-01-03
**Branch**: `009-pdf-deck-builder`

## Overview

The `mermaid_to_deck` MCP tool generates a multi-page PDF from multiple Mermaid diagrams. Each diagram is rendered on its own page, scaled to fit, with optional titles.

## Prerequisites

- MCP server running with S3 storage configured
- S3-compatible storage (MinIO or AWS S3)
- CDN proxy (optional, for `cdn_url` in response)

## Basic Usage

### Minimal Request

```json
{
  "diagrams": [
    { "code": "graph TD\n  A --> B" },
    { "code": "sequenceDiagram\n  Alice->>Bob: Hello" }
  ]
}
```

### Full Request with Options

```json
{
  "diagrams": [
    { "code": "graph TD\n  A[Start] --> B[End]", "title": "Simple Flow" },
    { "code": "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi", "title": "Greeting" },
    { "code": "classDiagram\n  class Animal", "title": "Class Diagram" }
  ],
  "page_size": "a4",
  "orientation": "landscape",
  "show_titles": true,
  "margins": { "top": 48, "right": 36, "bottom": 48, "left": 36 },
  "theme": "default",
  "background": "#ffffff",
  "drop_shadow": true,
  "google_font": "Source Code Pro",
  "timeout_ms": 60000
}
```

## Response

### Success

```json
{
  "ok": true,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "artifact_id": "123e4567-e89b-12d3-a456-426614174000",
  "download_url": "https://s3.example.com/bucket/123e4567-e89b-12d3-a456-426614174000.pdf?...",
  "cdn_url": "https://cdn.example.com/123e4567-e89b-12d3-a456-426614174000.pdf",
  "curl_command": "curl -o 123e4567-e89b-12d3-a456-426614174000.pdf 'https://...'",
  "s3": {
    "bucket": "mermaid-artifacts",
    "key": "123e4567-e89b-12d3-a456-426614174000.pdf",
    "region": "us-east-1"
  },
  "expires_in_seconds": 3600,
  "content_type": "application/pdf",
  "size_bytes": 45678,
  "page_count": 3,
  "pages": [
    { "index": 0, "title": "Simple Flow", "diagram_type": "flowchart" },
    { "index": 1, "title": "Greeting", "diagram_type": "sequence" },
    { "index": 2, "title": "Class Diagram", "diagram_type": "class" }
  ],
  "warnings": [],
  "errors": []
}
```

### Error

```json
{
  "ok": false,
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "warnings": [],
  "errors": [
    {
      "code": "PARSE_ERROR",
      "message": "Mermaid syntax error: Parse error on line 2",
      "details": {
        "diagram_index": 1,
        "line": 2
      }
    }
  ]
}
```

## Page Sizes

| Size | Portrait | Landscape |
|------|----------|-----------|
| `letter` | 612×792 | 792×612 |
| `a4` | 595×842 | 842×595 |
| `legal` | 612×1008 | 1008×612 |

## Limits

| Limit | Value |
|-------|-------|
| Max diagrams | 100 |
| Max total input | 10MB |
| Max per diagram | 1MB |
| Max timeout | 120 seconds |

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Empty diagrams array or missing code |
| `INPUT_TOO_LARGE` | Exceeds size/count limits |
| `PARSE_ERROR` | Mermaid syntax error |
| `RENDER_TIMEOUT` | Global timeout exceeded |
| `RENDER_FAILED` | Browser/renderer failure |
| `PDF_GENERATION_FAILED` | PDF assembly failure |
| `STORAGE_FAILED` | S3 upload failure |

## MCP Inspector CLI Testing

```bash
# List available tools (verify mermaid_to_deck is registered)
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/list

# Call the tool
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_deck \
  --tool-arg diagrams='[{"code":"graph TD\n  A-->B"},{"code":"sequenceDiagram\n  A->>B:Hi"}]'
```

## Integration with Claude

```
Please generate a PDF deck with these diagrams:

1. A flowchart showing user login flow
2. A sequence diagram of the authentication process
3. A class diagram of the User entity

Use A4 landscape with dark theme.
```

The tool returns a download URL that Claude can share with you.
