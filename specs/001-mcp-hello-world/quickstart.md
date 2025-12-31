# Quickstart: Mermaid MCP Server

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Claude Code (for MCP integration)

## Setup

```bash
# Clone and install
git clone <repo-url>
cd mermaid-mcp
npm install

# Build
npm run build

# Run quality checks
npm run quality
```

## Project Structure

```text
mermaid-mcp/
├── src/
│   ├── index.ts         # MCP server entry point
│   ├── tools/           # Tool implementations
│   ├── schemas/         # Zod schemas
│   └── version.ts       # Version export
├── tests/
│   └── behavior/        # Behavior tests
├── dist/                # Built output
└── specs/               # Feature specifications
```

## Development Commands

```bash
# Run all quality checks (required before every push)
npm run quality

# Individual commands
npm run test           # Run tests
npm run typecheck      # TypeScript type checking
npm run lint           # Biome linting
npm run format:check   # Biome format check
npm run build          # Build to dist/

# Development
npm run format         # Auto-fix formatting
npm run lint:fix       # Auto-fix lint issues
```

## Claude Code Configuration

Add to your Claude Code MCP settings (`~/.config/claude-code/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "mermaid-printer": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/mermaid-mcp"
    }
  }
}
```

Then restart Claude Code to load the server.

## Verify Installation

In Claude Code, the `healthcheck` tool should be available:

```
Use the healthcheck tool to verify the mermaid-printer server is running.
```

Expected response:
```json
{
  "ok": true,
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2025-12-30T12:00:00.000Z"
}
```

## Testing Echo Functionality

```
Use the healthcheck tool with echo set to "hello world"
```

Expected response includes:
```json
{
  "ok": true,
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2025-12-30T12:00:00.000Z",
  "echo": "hello world"
}
```

## TDD Workflow

Per project constitution, all changes follow TDD:

1. Write failing test for the behavior
2. Run `npm run test` - verify it fails
3. Write minimal code to pass
4. Run `npm run quality` - all checks must pass
5. Commit and push

## Clean Slate Protocol

Before every `git push`, run from clean state:

```bash
npm run clean
rm -rf node_modules && npm install
npm run quality
```

## Troubleshooting

### Server doesn't start
- Check Node.js version: `node --version` (needs 20+)
- Verify build: `npm run build`
- Check for TypeScript errors: `npm run typecheck`

### Claude Code doesn't see the server
- Verify absolute path in MCP config
- Restart Claude Code after config changes
- Check server runs manually: `node dist/index.js`

### Tests fail
- Run `npm run quality` to see all failures
- Check test output for specific assertion failures
- Ensure you're testing behavior, not implementation
