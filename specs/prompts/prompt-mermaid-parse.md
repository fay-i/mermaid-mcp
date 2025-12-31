# Mermaid Printer — MCP Tool Specification: mermaid_parse

## Goal
Add a `mermaid_parse` tool to the MCP server that parses Mermaid source code and returns structured metadata (AST) without rendering.

## Dependency
Independent — no dependencies on other tools.

## Tool: `mermaid_parse`

### Purpose
Parse Mermaid code and return diagram metadata: type, nodes, edges, labels, and structure. Useful for validation, analysis, or programmatic diagram inspection without rendering overhead.

### Input Schema
```json
{
  "code": "string (required, Mermaid diagram source)",
  "include_positions": "boolean (optional; include line/column positions for nodes; default false)"
}
```

### Output Schema (on success)
```json
{
  "ok": true,
  "request_id": "uuid",
  "warnings": [],
  "errors": [],
  "diagram_type": "string (e.g. 'flowchart', 'sequence', 'classDiagram')",
  "ast": {
    "nodes": [
      { "id": "string", "label": "string", "type": "string" }
    ],
    "edges": [
      { "from": "string", "to": "string", "label": "string", "type": "string" }
    ],
    "metadata": {}
  }
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
- If `ok=false`, tool-specific payloads (`diagram_type`, `ast`) MUST be omitted

## Considerations
- AST structure varies by diagram type (flowchart has nodes/edges, sequence has actors/messages, etc.)
- Consider whether to normalize all diagram types to a common schema or return type-specific structures
- Parsing should be fast since no rendering is involved
- Error messages should include parse location (line, column) when possible
- May need to expose Mermaid's internal parser or use a separate parsing approach

## Use Cases
- Validate Mermaid syntax before rendering
- Extract diagram statistics (node count, complexity)
- Build tools that analyze or transform diagrams
- Provide syntax error details with precise locations
