# Mermaid Printer — MCP Tool Specification: mermaid_to_svg

## Goal
Implement the core `mermaid_to_svg` tool for the MCP server that converts Mermaid diagram source code to SVG.

## Dependency
Requires `000-hello-world` (MCP server foundation) to be implemented first.

## Tool: `mermaid_to_svg`

### Purpose
Render Mermaid code into a clean SVG string suitable for embedding in documents, web pages, or other outputs.

### Input Schema
```json
{
  "code": "string (required, Mermaid diagram source)",
  "theme": "string (optional; 'default', 'dark', 'forest', 'neutral')",
  "background": "string (optional; e.g. 'transparent', '#ffffff')",
  "config_json": "object (optional; Mermaid config passed to renderer)",
  "timeout_ms": "number (optional; default 30000; min 1000; max 120000)"
}
```

### Output Schema (on success)
```json
{
  "ok": true,
  "request_id": "uuid",
  "warnings": [],
  "errors": [],
  "svg": "string (SVG markup)"
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
- All responses are valid JSON
- All responses include: `ok`, `request_id`, `warnings`, `errors`
- If `ok=false`, tool-specific payloads (`svg`) MUST be omitted
- Identical inputs MUST produce identical outputs (deterministic)

## Error Codes
- `INVALID_INPUT`: Missing or empty `code` parameter
- `INVALID_TIMEOUT`: `timeout_ms` outside valid range (1000-120000)
- `INVALID_CONFIG`: Malformed `config_json`
- `PARSE_ERROR`: Mermaid syntax error
- `UNSUPPORTED_DIAGRAM`: Diagram type not supported
- `INPUT_TOO_LARGE`: Input exceeds size limit (>1MB)
- `RENDER_TIMEOUT`: Rendering exceeded timeout
- `RENDER_FAILED`: Renderer crash or unexpected failure

## Acceptance Criteria
1. Valid Mermaid flowchart returns `ok: true` with valid SVG
2. Theme parameter applies correct styling to output
3. Background parameter sets SVG background correctly
4. Same input + options = identical SVG output (byte-for-byte)
5. Invalid syntax returns `ok: false` with descriptive error
6. Empty code returns validation error
7. Timeout enforcement within 500ms accuracy
8. Resources cleaned up after each request

## Supported Diagram Types
- flowchart
- sequence
- class
- state
- ER (entity-relationship)
- gantt
- pie
- journey

## Considerations
- Renderer choice (Mermaid CLI, Puppeteer, Playwright) deferred to implementation
- SVG output follows SVG 1.1 specification
- Each request is isolated (no shared state between renders)
- Resource cleanup includes temp files, child processes, browser instances
