# Mermaid Printer — MCP Server Foundation: Hello World

## Goal
Set up a minimal MCP server using stdio transport that can connect to Claude Code. This establishes the project foundation before implementing any Mermaid-specific tools.

## Dependency
None — this is the first implementation.

## Requirements

### Project Setup
- Node.js with TypeScript
- MCP SDK (`@modelcontextprotocol/sdk`)
- stdio transport (works well with Claude Code)
- ESLint, Prettier, Vitest for quality gates
- Single `npm run quality` command for all checks

### Tool: `healthcheck`

#### Purpose
Verify the MCP server is running and responding. Returns status and version information.

#### Input Schema
```json
{
  "echo": "string (optional; value to echo back for round-trip verification)"
}
```

#### Output Schema
```json
{
  "ok": true,
  "status": "healthy",
  "version": "string (package.json version)",
  "timestamp": "string (ISO 8601)",
  "echo": "string (if provided in input)"
}
```

## Project Structure
```text
/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── tools/
│   │   └── healthcheck.ts # Healthcheck tool implementation
│   └── schemas/
│       └── healthcheck.ts # JSON schema for healthcheck
└── tests/
    └── healthcheck.test.ts
```

## Implementation Notes

### MCP Server Setup (src/index.ts)
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "mermaid-printer", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Register tools...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Claude Code Configuration
Add to Claude Code MCP settings:
```json
{
  "mcpServers": {
    "mermaid-printer": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/mermaid-mcp"
    }
  }
}
```

## Acceptance Criteria
1. `npm install` completes without errors
2. `npm run build` produces valid JavaScript in `dist/`
3. `npm run quality` passes (tests, types, lint, format)
4. Server starts and connects via stdio
5. `healthcheck` tool responds with status and version
6. `healthcheck` with `echo` parameter returns the echoed value
7. Claude Code can discover and invoke the `healthcheck` tool

## Scripts (package.json)
```json
{
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests",
    "format:check": "prettier --check .",
    "format": "prettier --write .",
    "quality": "npm run test && npm run typecheck && npm run lint && npm run format:check && npm run build"
  }
}
```

## Success Criteria
- MCP server runs without errors
- Claude Code successfully connects
- Healthcheck tool discoverable and invocable
- All quality gates pass
- Ready to build Mermaid-specific tools on this foundation
