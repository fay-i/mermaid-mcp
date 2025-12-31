# Mermaid Printer — MCP Tool Specification: mermaid_to_pdf

## Goal
Add a `mermaid_to_pdf` tool to the MCP server that converts Mermaid diagrams to PDF format.

## Dependency
Requires `mermaid_to_svg` tool to be implemented first. This tool renders to SVG internally, then converts to PDF.

## Tool: `mermaid_to_pdf`

### Purpose
Render Mermaid code into a PDF document (vector).

### Input Schema
```json
{
  "code": "string (required, Mermaid diagram source)",
  "theme": "string (optional; e.g. 'default', 'dark')",
  "background": "string (optional; e.g. 'white', '#ffffff')",
  "config_json": "object (optional; Mermaid config passed to renderer)",
  "timeout_ms": "number (optional; default 30000; min 1000; max 120000)",
  "page_size": "string (optional; e.g. 'A4', 'letter', 'auto'; default 'auto')",
  "orientation": "string (optional; 'portrait' or 'landscape'; default 'auto')"
}
```

### Output Schema (on success)
```json
{
  "ok": true,
  "request_id": "uuid",
  "warnings": [],
  "errors": [],
  "pdf_base64": "string (base64-encoded PDF bytes)"
}
```

### Output Schema (on failure)
```json
{
  "ok": false,
  "request_id": "uuid",
  "warnings": [],
  "errors": [{ "code": "string", "message": "string", "details": {} }]
}
```

## Global Output Convention
Follows the same conventions as `mermaid_to_svg`:
- All responses are valid JSON
- All responses include: `ok`, `request_id`, `warnings`, `errors`
- If `ok=false`, tool-specific payloads (`pdf_base64`) MUST be omitted

## Considerations
- PDF output must be valid and renderable in standard PDF viewers
- Page size should auto-fit diagram if set to 'auto'
- Consider whether to embed fonts or use system fonts
- Base64 encoding chosen for JSON transport; consider size limits for very large diagrams
