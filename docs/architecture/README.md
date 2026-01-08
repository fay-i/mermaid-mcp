# Mermaid MCP Server Architecture

This document provides a comprehensive overview of the Mermaid MCP Server architecture, a Model Context Protocol (MCP) server that renders Mermaid diagrams to SVG and PDF formats.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [MCP Tools](#mcp-tools)
3. [Rendering Pipeline](#rendering-pipeline)
4. [Storage System](#storage-system)
5. [Configuration](#configuration)
6. [Deployment](#deployment)

---

## High-Level Architecture

The Mermaid MCP Server is built using the `@modelcontextprotocol/sdk` and follows a modular architecture with clear separation of concerns.

![High-Level Architecture](01-high-level-architecture.svg)

### Core Components

| Component | Description |
|-----------|-------------|
| **MCP Server** | Core server implementing the Model Context Protocol |
| **Tool Registry** | Registers and dispatches tool calls |
| **Rendering Engine** | Puppeteer + Mermaid CLI for diagram rendering |
| **Storage Layer** | Pluggable backends for artifact persistence |

### Request Flow

1. MCP client connects via stdio to the Docker container
2. Client invokes a tool (e.g., `mermaid_to_svg`)
3. Server validates input against Zod schemas
4. Renderer generates the artifact
5. Storage backend persists and returns a download URL
6. Server returns the result to the client

---

## MCP Tools

The server exposes four tools via the MCP protocol:

![Tools and Inputs](07-tools-and-inputs.svg)

### Tool Summary

| Tool | Description | Storage Required |
|------|-------------|------------------|
| `healthcheck` | Server health verification | No |
| `mermaid_to_svg` | Render diagram to SVG | Optional |
| `mermaid_to_pdf` | Render diagram to PDF | Optional |
| `mermaid_to_deck` | Multi-diagram PDF deck | **Yes** |

### healthcheck

Verifies server health and returns version information.

**Input:**
- `echo` (optional): String to echo back

**Output:**
```json
{
  "ok": true,
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-01-07T12:00:00.000Z",
  "echo": "test"
}
```

### mermaid_to_svg

Renders a Mermaid diagram to SVG format.

**Input Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | string | required | Mermaid source (1-1MB) |
| `theme` | enum | `"default"` | `default`, `dark`, `forest`, `neutral` |
| `background` | string | `"#ffffff"` | CSS color value |
| `config_json` | string | - | Advanced Mermaid config |
| `timeout_ms` | number | `30000` | Render timeout (1000-120000) |
| `drop_shadow` | boolean | `true` | Apply drop shadows |
| `google_font` | string | `"Source Code Pro"` | Custom font |

**Output:**
- With storage: Returns download URL (`file://` or `https://`)
- Without storage: Returns inline SVG string

### mermaid_to_pdf

Renders a Mermaid diagram to PDF format. Same parameters as `mermaid_to_svg`.

**Timeout Budget:**
- SVG rendering: 80% of `timeout_ms`
- PDF generation: 20% of `timeout_ms`

### mermaid_to_deck

Generates a multi-page PDF deck from multiple diagrams.

**Additional Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `diagrams` | array | required | 1-100 diagrams with `code` and optional `title` |
| `page_size` | enum | `"letter"` | `letter`, `a4`, `legal` |
| `orientation` | enum | `"landscape"` | `landscape`, `portrait` |
| `show_titles` | boolean | `true` | Show diagram titles |
| `margins` | object | `{top: 36, right: 36, bottom: 36, left: 36}` | Page margins in points |

**Constraints:**
- Maximum 100 diagrams
- Maximum 1MB per diagram
- Maximum 10MB total input

---

## Rendering Pipeline

### SVG Rendering Sequence

![Rendering Sequence](02-rendering-sequence.svg)

### Rendering Steps

1. **Browser Launch**: Puppeteer launches a headless Chrome instance
2. **Mermaid Rendering**: Mermaid CLI parses and renders the diagram
3. **Post-Processing**:
   - Drop shadow filter injection
   - Google Font embedding
   - Dimension extraction
4. **Storage**: Artifact persisted to configured backend
5. **URL Generation**: Download URL returned to client

### Post-Processing Features

**Drop Shadow Filter:**
```xml
<filter id="drop-shadow">
  <feDropShadow dx="2" dy="2" stdDeviation="2" 
                flood-color="#000000" flood-opacity="0.25"/>
</filter>
```

**Google Font Injection:**
Embeds custom fonts via Google Fonts API for consistent rendering.

### Deck Assembly Pipeline

![Deck Pipeline](04-deck-pipeline.svg)

For multi-diagram decks:
1. Each diagram is rendered to SVG
2. SVGs are converted to PDF pages via Puppeteer
3. Pages are merged using `pdf-lib`
4. Final deck is stored and URL returned

---

## Storage System

### Storage Backend Interface

![Storage Class Diagram](03-storage-class-diagram.svg)

The storage system uses a pluggable backend architecture implementing the `StorageBackend` interface:

```typescript
interface StorageBackend {
  initialize(): Promise<void>;
  store(sessionId, artifactId, content, contentType): Promise<StorageResult>;
  retrieve(sessionId, artifactId): Promise<Buffer>;
  delete(sessionId, artifactId): Promise<void>;
  exists(sessionId, artifactId): Promise<boolean>;
  getType(): "local" | "s3";
}
```

### Storage Factory

![Storage Factory](05-storage-factory.svg)

The factory auto-detects the appropriate backend based on configuration:

1. **Explicit Selection**: `STORAGE_TYPE=local` or `STORAGE_TYPE=s3`
2. **Auto-Detection** (`STORAGE_TYPE=auto`):
   - If S3 credentials present → S3 backend
   - If local path configured → Local backend
   - Otherwise → Inline mode (no persistence)

### Local Storage Backend

**Features:**
- Atomic writes (write to `.tmp`, then rename)
- Startup cleanup of orphaned temp files
- Configurable URL scheme (`file://` or `http://`)

**Directory Structure:**
```
/app/data/artifacts/
├── {session-uuid}/
│   ├── {artifact-uuid}.svg
│   └── {artifact-uuid}.pdf
└── {session-uuid}/
    └── ...
```

### S3 Storage Backend

**Features:**
- Presigned URL generation for secure access
- Path-style access (MinIO compatible)
- Configurable URL expiry

---

## Request Lifecycle

![Tool Request Lifecycle](06-tool-request-lifecycle.svg)

### States

| State | Description |
|-------|-------------|
| **Received** | Tool request received from client |
| **Validating** | Input validation against Zod schema |
| **Rendering** | Mermaid CLI processing |
| **PostProcess** | SVG enhancement (shadows, fonts) |
| **Storing** | Artifact persistence |
| **Complete** | Success response with URL |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Empty or malformed input |
| `INPUT_TOO_LARGE` | Exceeds size limit |
| `PARSE_ERROR` | Mermaid syntax error |
| `RENDER_TIMEOUT` | Exceeded timeout budget |
| `RENDER_FAILED` | Browser/Puppeteer error |
| `PDF_GENERATION_FAILED` | PDF conversion error |
| `INTERNAL_ERROR` | Unexpected error |

---

## Configuration

### Environment Variables

#### Storage Selection

| Variable | Values | Description |
|----------|--------|-------------|
| `STORAGE_TYPE` | `auto`, `local`, `s3` | Storage backend selection |

#### Local Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTAINER_STORAGE_PATH` | `/app/data/artifacts` | Container mount path |
| `HOST_STORAGE_PATH` | `./data/artifacts` | Host path for file:// URLs |
| `LOCAL_URL_SCHEME` | `file` | `file` or `http` |
| `CDN_HOST` | `localhost` | CDN hostname (for http scheme) |
| `CDN_PORT` | `3001` | CDN port (for http scheme) |

#### S3 Storage

| Variable | Description |
|----------|-------------|
| `MERMAID_S3_ENDPOINT` | S3/MinIO endpoint URL |
| `MERMAID_S3_BUCKET` | Bucket name |
| `MERMAID_S3_ACCESS_KEY` | Access key |
| `MERMAID_S3_SECRET_KEY` | Secret key |
| `AWS_REGION` | AWS region (default: `us-east-1`) |

---

## Deployment

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/mermaid-mcp.git
   cd mermaid-mcp
   ```

2. Start the container:
   ```bash
   docker compose up -d
   ```

3. Configure your MCP client (VS Code example in `.vscode/mcp.json`):
   ```json
   {
     "servers": {
       "mermaid-mcp": {
         "type": "stdio",
         "command": "docker",
         "args": ["exec", "-i", "mermaid-mcp", "node", "dist/index.js"]
       }
     }
   }
   ```

### Docker Compose Configuration

The default `docker-compose.yml` includes:

- **Port 8000**: SSE endpoint (optional, for HTTP-based clients)
- **Port 3001**: CDN proxy for artifact downloads
- **Volume**: `./data/artifacts` mounted for persistence

### Production Considerations

1. **S3 Storage**: Configure S3/MinIO for scalable artifact storage
2. **Resource Limits**: Set container memory/CPU limits
3. **Health Checks**: Built-in health endpoint at `/health`
4. **Logging**: Logs to stderr for container log aggregation

---

## Source Code Structure

```
src/
├── index.ts           # MCP server entry point
├── version.ts         # Version constant
├── tools/             # Tool implementations
│   ├── healthcheck.ts
│   ├── mermaid-to-svg.ts
│   ├── mermaid-to-pdf.ts
│   └── mermaid-to-deck.ts
├── renderer/          # Rendering engine
│   ├── browser.ts     # Puppeteer lifecycle
│   ├── render.ts      # Mermaid → SVG
│   └── deck-assembler.ts  # PDF merging
├── storage/           # Storage backends
│   ├── factory.ts     # Backend factory
│   ├── local.ts       # Local filesystem
│   └── s3-client.ts   # S3/MinIO
└── schemas/           # Zod schemas
    ├── mermaid-to-svg.ts
    ├── mermaid-to-pdf.ts
    ├── mermaid-to-deck.ts
    └── error-codes.ts
```
