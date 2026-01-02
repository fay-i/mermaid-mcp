# Data Model: Mermaid to PDF Tool

**Date**: 2026-01-02
**Feature**: 003-mermaid-to-pdf

## Entities

### MermaidToPdfInput

Input parameters for the `mermaid_to_pdf` MCP tool. Mirrors `mermaid_to_svg` for consistency.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| code | string | Yes | 1 byte – 1 MB | Mermaid diagram source code |
| theme | enum | No | "default", "dark", "forest", "neutral" | Diagram color theme |
| background | string | No | CSS color value | Background color (e.g., "white", "#f0f0f0", "transparent") |
| config_json | string | No | Valid JSON object | Advanced Mermaid configuration |
| timeout_ms | integer | No | 1000–120000 | Render timeout in milliseconds (default: 30000) |

### MermaidToPdfOutput (Success)

Successful response when PDF generation completes.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| ok | boolean | Always `true` | Discriminator for success |
| request_id | string | UUID v4 | Unique request identifier for tracing |
| pdf | string | Base64-encoded | PDF document data |
| warnings | Warning[] | May be empty | Non-fatal warnings encountered |
| errors | RenderError[] | Always empty | Empty array for success responses |

### MermaidToPdfOutput (Error)

Error response when PDF generation fails.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| ok | boolean | Always `false` | Discriminator for error |
| request_id | string | UUID v4 | Unique request identifier for tracing |
| warnings | Warning[] | May be empty | Non-fatal warnings encountered |
| errors | RenderError[] | At least 1 | Error details |

**Note**: Error responses do NOT include a `pdf` field.

### RenderError

Structured error information.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| code | ErrorCode | Enum value | Stable error code for programmatic handling |
| message | string | Non-empty | Human-readable error description |
| details | object | Optional | Additional context (e.g., line number for parse errors) |

### ErrorCode (Extended)

Error codes for `mermaid_to_pdf`. Extends existing SVG error codes.

| Code | Source | Description |
|------|--------|-------------|
| INVALID_INPUT | SVG | Empty or whitespace-only code |
| INPUT_TOO_LARGE | SVG | Code exceeds 1 MB |
| PARSE_ERROR | SVG | Invalid Mermaid syntax |
| UNSUPPORTED_DIAGRAM | SVG | Diagram type not supported |
| INVALID_CONFIG | SVG | Malformed config_json |
| INVALID_TIMEOUT | SVG | timeout_ms outside valid range |
| RENDER_TIMEOUT | SVG | Rendering exceeded timeout |
| RENDER_FAILED | SVG | General rendering failure |
| **PDF_GENERATION_FAILED** | **NEW** | SVG rendered but PDF conversion failed |

### Warning

Non-fatal warning information (inherited from SVG schema).

| Field | Type | Description |
|-------|------|-------------|
| code | string | Warning identifier |
| message | string | Warning description |

## Entity Relationships

```
MermaidToPdfInput
       │
       ▼
┌──────────────┐
│   Validate   │
│    Input     │
└──────┬───────┘
       │
       ▼ (validation error)
MermaidToPdfOutput (Error)
       │
       ▼ (validation pass)
┌──────────────┐
│  Render SVG  │
│  (existing)  │
└──────┬───────┘
       │
       ▼ (render error)
MermaidToPdfOutput (Error)
       │
       ▼ (SVG success)
┌──────────────┐
│ Convert PDF  │
│    (new)     │
└──────┬───────┘
       │
       ▼ (conversion error)
MermaidToPdfOutput (Error)
       │
       ▼ (success)
MermaidToPdfOutput (Success)
```

## State Transitions

The tool is stateless. Each request is independent with no persistent state.

| Phase | Input State | Output State | Possible Errors |
|-------|-------------|--------------|-----------------|
| Validation | Raw input | Validated input | INVALID_INPUT, INPUT_TOO_LARGE, INVALID_CONFIG, INVALID_TIMEOUT |
| SVG Render | Validated input | SVG string | PARSE_ERROR, UNSUPPORTED_DIAGRAM, RENDER_TIMEOUT, RENDER_FAILED |
| PDF Convert | SVG string | PDF buffer | PDF_GENERATION_FAILED |
| Encode | PDF buffer | Base64 string | (none) |

## Validation Rules

### code
- MUST NOT be empty or whitespace-only
- MUST NOT exceed 1,048,576 bytes (1 MB)
- UTF-8 encoded

### theme
- MUST be one of: "default", "dark", "forest", "neutral"
- Case-sensitive

### background
- Valid CSS color (hex, rgb, rgba, named colors)
- "transparent" is valid
- No validation beyond string type (Mermaid handles validation)

### config_json
- MUST be valid JSON if provided
- MUST be a JSON object (not array, string, or null)
- Content passed to Mermaid; Mermaid validates specific options

### timeout_ms
- MUST be integer ≥ 1000
- MUST be integer ≤ 120000
- Default: 30000

## Schema Reuse

The `mermaid_to_pdf` schema extends `mermaid_to_svg` patterns:

| Component | Reuse Strategy |
|-----------|----------------|
| Input schema | Identical to SVG (copy pattern) |
| Error codes | Extend with PDF_GENERATION_FAILED |
| Output structure | Same discriminated union pattern |
| Warning schema | Reuse directly from SVG |
| RenderError schema | Reuse directly from SVG |

## Base64 Encoding

PDF output is encoded as base64 for MCP transport:

```typescript
// PDF buffer to base64
const base64Pdf = pdfBuffer.toString('base64');

// Client decode
const pdfBuffer = Buffer.from(base64Pdf, 'base64');
```

Estimated sizes:
- Base64 overhead: ~33% larger than raw binary
- Typical flowchart PDF: 5–50 KB raw → 7–70 KB base64
- Maximum: Bounded by timeout, not explicit size limit
