# Implementation Plan: MCP Server Foundation - Hello World

**Branch**: `001-mcp-hello-world` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mcp-hello-world/spec.md`

## Summary

Set up a minimal MCP server using stdio transport with a `healthcheck` tool that validates server connectivity and provides diagnostic echo functionality. The implementation follows the Sentry MCP server architecture patterns using TypeScript, Vitest, Biome (linting/formatting), and the official `@modelcontextprotocol/sdk`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24+, ESM modules
**Primary Dependencies**: `@modelcontextprotocol/sdk`, `zod` (schema validation)
**Storage**: N/A (stateless healthcheck tool)
**Testing**: Vitest (behavior tests, per constitution TDD requirements)
**Target Platform**: Node.js CLI via stdio transport (Claude Code integration)
**Project Type**: Single package (simpler than Sentry's monorepo for this minimal server)
**Performance Goals**: Healthcheck response < 100ms (per SC-002)
**Constraints**: Server startup < 5 seconds (per SC-001)
**Scale/Scope**: Foundation for 2-5 tools (healthcheck, mermaid_to_svg, potential PDF export)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Epistemic Humility | PASS | All code verified by running quality checks, not mental execution |
| II. TDD by Behavior | PASS | Tests written first for observable behavior (healthcheck contract) |
| III. CI-First Local Verification | PASS | `npm run quality` runs all checks before push |
| IV. No Skips/Ignores/Bypasses | PASS | No test.skip, @ts-ignore, eslint-disable allowed |
| V. Type Policy | PASS | Strict types in implementation, pragmatic in tests |
| VI. Tool Contract Discipline | PASS | JSON schemas for healthcheck input/output |
| VII. PR Structure | PASS | Foundation setup as its own atomic PR |
| VIII. Iteration Loop | PASS | 10-minute TDD cycles with CI verification |
| IX. CI in GitHub Actions | PASS | Workflow mirrors local quality command |
| X. Local Gates | PASS | Single `npm run quality` command runs all checks |
| XI. Task Derivation | PASS | Tasks derived from this plan via /speckit.tasks |

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-hello-world/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output - technology decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - developer setup guide
├── contracts/           # Phase 1 output - JSON schemas
│   ├── healthcheck-input.json
│   └── healthcheck-output.json
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── index.ts             # MCP server entry point with stdio transport
├── tools/
│   ├── index.ts         # Tool registry (exports all tools)
│   ├── types.ts         # ToolConfig interface definition
│   ├── healthcheck.ts   # Healthcheck tool implementation
│   └── mermaid-to-svg.ts  # (future) Mermaid rendering tool
├── renderer/            # (future) Mermaid rendering logic
│   └── index.ts
├── schemas/
│   ├── healthcheck.ts   # Zod schemas for input/output
│   ├── mermaid-to-svg.ts  # (future)
│   └── index.ts         # Schema exports
└── version.ts           # Version from package.json

tests/
├── behavior/
│   ├── healthcheck.test.ts    # Healthcheck behavior tests
│   ├── server.test.ts         # Server startup/connection tests
│   └── mermaid-to-svg.test.ts # (future)
└── fixtures/
    └── diagrams/        # (future) Test Mermaid sources

# Config files at root
package.json
tsconfig.json
vitest.config.ts
biome.json
.github/workflows/ci.yml
```

**Structure Decision**: Single-package structure (not monorepo). With 2-5 tools in one MCP server, all sharing the same transport and deployment, a monorepo adds complexity without benefit. The structure mirrors Sentry MCP's `mcp-core` internal organization with `tools/`, `renderer/`, `schemas/`, and behavior tests. Can evolve to monorepo later if we add multiple transports or separate npm packages.

## Complexity Tracking

> No violations to justify - structure follows YAGNI principle with minimal viable architecture.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Single package vs monorepo | Single package | Only one tool, no need for package separation |
| Biome vs ESLint+Prettier | Biome | Single tool for lint+format, used by Sentry MCP |
| npm vs pnpm | npm | Simpler for single package, pnpm better for monorepos |
| tsdown vs tsc | tsc | Simpler build, tsdown better for complex bundling needs |

## Reference Implementations

### Sentry MCP Server (getsentry/sentry-mcp)
- **Architecture**: Monorepo with `mcp-core` (tools, schemas, server) and `mcp-server` (stdio entry point)
- **Tool Pattern**: `defineTool()` helper with name, description, inputSchema, handler
- **Testing**: Vitest with behavior tests co-located with tools (`*.test.ts`)
- **Build**: tsdown for bundling, Biome for lint/format
- **Key Files**: `server.ts` (buildServer), `tools/whoami.ts` (simple tool example)

### Official MCP Servers (modelcontextprotocol/servers)
- **Architecture**: Individual servers in `src/` directory
- **Tool Pattern**: Direct `server.tool()` registration with zod schemas
- **Entry Point**: `index.ts` with transport selection (stdio/sse/http)
- **Dependencies**: `@modelcontextprotocol/sdk`, `zod`, `zod-to-json-schema`

## Key Implementation Decisions

1. **Use `@modelcontextprotocol/sdk` McpServer class** - Standard MCP server implementation
2. **Zod for schema validation** - Type-safe input validation with JSON schema generation
3. **Stdio transport only** - Simplest transport for Claude Code integration
4. **Version from package.json** - Dynamic version reporting in healthcheck
5. **Biome for linting/formatting** - Single tool, fast, used by Sentry MCP
6. **Vitest for testing** - Fast, ESM-native, good TypeScript support
