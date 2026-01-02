# Quickstart: Mermaid to PDF Tool

**Feature**: 003-mermaid-to-pdf
**Date**: 2026-01-02

## Overview

The `mermaid_to_pdf` MCP tool converts Mermaid diagram source code to PDF format. It leverages the existing `mermaid_to_svg` rendering pipeline and Puppeteer's native PDF generation to produce vector-quality PDFs.

## Prerequisites

1. Node.js 24+ installed
2. Project dependencies installed: `npm install`
3. Project builds successfully: `npm run build`

## Basic Usage

### MCP Client Call

```json
{
  "method": "tools/call",
  "params": {
    "name": "mermaid_to_pdf",
    "arguments": {
      "code": "graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[End]\n  B -->|No| D[Loop]\n  D --> B"
    }
  }
}
```

### Expected Response (Success)

```json
{
  "ok": true,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "pdf": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL...",
  "warnings": [],
  "errors": []
}
```

### Decoding the PDF

```typescript
// Node.js
const pdfBuffer = Buffer.from(response.pdf, 'base64');
fs.writeFileSync('diagram.pdf', pdfBuffer);

// Browser
const pdfBlob = new Blob(
  [Uint8Array.from(atob(response.pdf), c => c.charCodeAt(0))],
  { type: 'application/pdf' }
);
const url = URL.createObjectURL(pdfBlob);
window.open(url);
```

## Configuration Options

### Theme Selection

```json
{
  "code": "graph TD\n  A --> B",
  "theme": "dark"
}
```

Available themes: `"default"`, `"dark"`, `"forest"`, `"neutral"`

### Background Color

```json
{
  "code": "graph TD\n  A --> B",
  "background": "white"
}
```

Accepts any CSS color value: `"white"`, `"#f0f0f0"`, `"transparent"`, etc.

### Custom Timeout

```json
{
  "code": "graph TD\n  A --> B",
  "timeout_ms": 60000
}
```

Range: 1000–120000 ms (default: 30000 ms)

### Advanced Mermaid Configuration

```json
{
  "code": "graph TD\n  A --> B",
  "config_json": "{\"flowchart\":{\"curve\":\"basis\"}}"
}
```

## Error Handling

### Error Response Structure

```json
{
  "ok": false,
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "warnings": [],
  "errors": [
    {
      "code": "PARSE_ERROR",
      "message": "Mermaid syntax error: Parse error on line 2",
      "details": { "line": 2 }
    }
  ]
}
```

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `INVALID_INPUT` | Empty or whitespace-only code | Provide valid Mermaid code |
| `INPUT_TOO_LARGE` | Code exceeds 1 MB | Reduce diagram complexity |
| `PARSE_ERROR` | Invalid Mermaid syntax | Fix syntax at indicated line |
| `UNSUPPORTED_DIAGRAM` | Diagram type not supported | Use supported diagram type |
| `INVALID_CONFIG` | Malformed config_json | Fix JSON syntax |
| `INVALID_TIMEOUT` | Timeout outside 1000–120000 range | Adjust timeout value |
| `RENDER_TIMEOUT` | Rendering exceeded timeout | Increase timeout or simplify diagram |
| `RENDER_FAILED` | General rendering failure | Check Mermaid code validity |
| `PDF_GENERATION_FAILED` | SVG rendered but PDF conversion failed | Report issue |

## Testing Locally

### MCP Inspector CLI

```bash
# List available tools
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list

# Generate a PDF
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_pdf \
  --tool-arg code="graph TD\n  A --> B"
```

### Save Output to File

```bash
# Using jq to extract and decode
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_pdf \
  --tool-arg code="graph TD\n  A --> B" \
  | jq -r '.pdf' \
  | base64 -d > diagram.pdf
```

## Comparison with mermaid_to_svg

| Feature | mermaid_to_svg | mermaid_to_pdf |
|---------|----------------|----------------|
| Output format | SVG (text) | PDF (base64) |
| Output field | `svg` | `pdf` |
| Vector quality | Yes | Yes |
| All diagram types | Yes | Yes |
| Theme support | Yes | Yes |
| Background support | Yes | Yes |
| Config support | Yes | Yes |
| Timeout support | Yes | Yes |
| Error codes | 8 codes | 9 codes (+PDF_GENERATION_FAILED) |

## Next Steps

1. Run the test suite: `npm run test`
2. Run integration tests: `npm run test:integration`
3. Try different diagram types (sequence, class, state, etc.)
4. Experiment with themes and backgrounds
