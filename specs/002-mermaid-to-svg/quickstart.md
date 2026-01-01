# Quickstart: mermaid_to_svg Tool

## Overview

The `mermaid_to_svg` tool converts Mermaid diagram source code to SVG format. It supports all major Mermaid diagram types and provides options for theme and background customization.

## Basic Usage

### Minimal Request

```json
{
  "code": "graph TD\n  A[Start] --> B[Process] --> C[End]"
}
```

### Response (Success)

```json
{
  "ok": true,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
  "warnings": [],
  "errors": []
}
```

## Customization Options

### Theme Selection

Available themes: `default`, `dark`, `forest`, `neutral`

```json
{
  "code": "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi!",
  "theme": "dark"
}
```

### Background Color

```json
{
  "code": "pie title Budget\n  \"Rent\" : 40\n  \"Food\" : 30\n  \"Savings\" : 30",
  "background": "transparent"
}
```

Supported values:
- `"transparent"` - No background
- CSS colors: `"#ffffff"`, `"white"`, `"rgb(255,255,255)"`

### Custom Timeout

```json
{
  "code": "classDiagram\n  Animal <|-- Dog\n  Animal <|-- Cat",
  "timeout_ms": 10000
}
```

Range: 1000-120000ms (default: 30000)

### Advanced Configuration

Pass Mermaid configuration as JSON string:

```json
{
  "code": "erDiagram\n  CUSTOMER ||--o{ ORDER : places",
  "config_json": "{\"er\":{\"layoutDirection\":\"TB\"}}"
}
```

## Supported Diagram Types

| Type | Directive Example |
|------|------------------|
| Flowchart | `graph TD` or `flowchart LR` |
| Sequence | `sequenceDiagram` |
| Class | `classDiagram` |
| State | `stateDiagram-v2` |
| ER | `erDiagram` |
| Gantt | `gantt` |
| Pie | `pie` |
| Journey | `journey` |

## Error Handling

### Parse Error (Invalid Syntax)

```json
{
  "ok": false,
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "warnings": [],
  "errors": [
    {
      "code": "PARSE_ERROR",
      "message": "Syntax error at line 2: unexpected token '>'",
      "details": {"line": 2}
    }
  ]
}
```

### Input Too Large

```json
{
  "ok": false,
  "request_id": "550e8400-e29b-41d4-a716-446655440002",
  "warnings": [],
  "errors": [
    {
      "code": "INPUT_TOO_LARGE",
      "message": "Input exceeds maximum size of 1MB"
    }
  ]
}
```

### Timeout Exceeded

```json
{
  "ok": false,
  "request_id": "550e8400-e29b-41d4-a716-446655440003",
  "warnings": [],
  "errors": [
    {
      "code": "RENDER_TIMEOUT",
      "message": "Render exceeded timeout of 30000ms"
    }
  ]
}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_INPUT` | Missing or empty `code` parameter |
| `INPUT_TOO_LARGE` | Code exceeds 1MB limit |
| `PARSE_ERROR` | Invalid Mermaid syntax |
| `UNSUPPORTED_DIAGRAM` | Unknown diagram type |
| `INVALID_CONFIG` | Malformed `config_json` |
| `INVALID_TIMEOUT` | `timeout_ms` out of range |
| `RENDER_TIMEOUT` | Rendering timed out |
| `RENDER_FAILED` | Renderer crashed |

## Integration via MCP Inspector

Test the tool using MCP Inspector CLI:

```bash
# List available tools
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list

# Render a simple flowchart
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_svg \
  --tool-arg code="graph TD\n  A-->B"

# Render with dark theme
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_svg \
  --tool-arg code="sequenceDiagram\n  Alice->>Bob: Hello" \
  --tool-arg theme=dark
```

## Deterministic Output

The tool produces deterministic output: identical inputs with identical options produce byte-for-byte identical SVG. This is useful for:
- Caching rendered diagrams
- Detecting diagram changes
- Reproducible documentation builds
