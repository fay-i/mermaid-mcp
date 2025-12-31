# Research: MCP Server Foundation - Hello World

**Date**: 2025-12-30
**Status**: Complete

## Research Questions

### 1. MCP SDK Selection

**Decision**: Use `@modelcontextprotocol/sdk` (official TypeScript SDK)

**Rationale**:
- Official SDK from Anthropic/ModelContextProtocol
- Used by both Sentry MCP and official example servers
- Provides `McpServer` class with `server.tool()` registration pattern
- Built-in support for stdio, SSE, and HTTP transports
- Active development with latest version supporting all MCP features

**Alternatives Considered**:
- Custom implementation: Rejected - reinventing the wheel
- Python SDK: Rejected - project uses TypeScript per spec assumptions

**Reference**:
- Sentry MCP: `@modelcontextprotocol/sdk` in `packages/mcp-server/package.json`
- Official servers: `@modelcontextprotocol/sdk` version `^1.24.3`

### 2. Schema Validation Library

**Decision**: Use `zod` for runtime validation with JSON schema generation

**Rationale**:
- Type-safe schema definitions that infer TypeScript types
- Used by both Sentry MCP and official example servers
- `zod-to-json-schema` for MCP tool schema generation
- Excellent error messages for validation failures
- Composable schemas for complex types

**Alternatives Considered**:
- JSON Schema only: Rejected - no TypeScript integration
- io-ts: Rejected - less ecosystem support, more verbose
- Ajv: Rejected - validation only, no type inference

**Reference**:
- Sentry MCP: `zod` in dependencies
- Official servers: `zod` + `zod-to-json-schema`

### 3. Linting and Formatting

**Decision**: Use Biome (single tool for lint + format)

**Rationale**:
- Single tool replaces ESLint + Prettier
- Extremely fast (written in Rust)
- Used by Sentry MCP (`biome.json` at root)
- Zero configuration needed for basic setup
- Consistent with modern TypeScript projects

**Alternatives Considered**:
- ESLint + Prettier: Works but two tools, slower, more config
- dprint: Less mature ecosystem
- Rome (predecessor): Deprecated in favor of Biome

**Reference**:
- Sentry MCP `biome.json` configuration

### 4. Testing Framework

**Decision**: Use Vitest for behavior testing

**Rationale**:
- Native ESM support (no transpilation issues)
- Fast execution with smart caching
- Jest-compatible API (familiar patterns)
- Used by Sentry MCP
- Excellent TypeScript support out of the box
- Built-in coverage reporting

**Alternatives Considered**:
- Jest: ESM support still problematic
- Mocha + Chai: More setup required
- Node test runner: Less mature ecosystem

**Reference**:
- Sentry MCP: `vitest` in devDependencies, `vitest.config.ts` per package

### 5. Build Tool

**Decision**: Use `tsc` (TypeScript compiler) for building

**Rationale**:
- Simple, reliable, no additional dependencies
- Produces clean ESM output
- Sufficient for single-package project
- Easy to debug build issues

**Alternatives Considered**:
- tsdown: Better for complex bundling (Sentry uses it for multi-entry builds)
- esbuild: Faster but less TypeScript feature support
- rollup: Overkill for CLI tool

**Reference**:
- Official servers use `tsc` for simpler packages
- Sentry uses `tsdown` for monorepo packages with multiple exports

### 6. Package Manager

**Decision**: Use npm (not pnpm)

**Rationale**:
- Simpler for single-package projects
- No workspace configuration needed
- Universal availability
- Sufficient for our needs

**Alternatives Considered**:
- pnpm: Better for monorepos (Sentry uses it), overkill for single package
- yarn: No significant advantage over npm for this project

### 7. Project Structure (Single Package vs Monorepo)

**Decision**: Single package with organized internal structure

**Rationale**:
- 2-5 tools in one MCP server sharing same transport
- All tools bundled and deployed together
- No separate npm packages needed
- Simpler CI/CD pipeline
- Can evolve to monorepo if needed later (multiple transports, separate packages)

**Alternatives Considered**:
- Monorepo (pnpm workspaces): Sentry pattern, but they have multiple deployment targets (stdio server, Cloudflare worker), separate npm packages. Overkill for our use case.

**When to reconsider**:
- If we need Cloudflare Workers deployment
- If we want to publish tools as separate npm packages
- If we add more than 10 tools with different dependencies

### 8. Transport Selection

**Decision**: stdio transport only (for now)

**Rationale**:
- Required for Claude Code integration
- Simplest to implement and test
- No server infrastructure needed
- Can add SSE/HTTP later if needed

**Reference**:
- Sentry `mcp-server` package: stdio as primary transport
- Official servers: Support multiple transports via CLI flag

### 9. TypeScript Configuration

**Decision**: Strict TypeScript with ESM modules

**Key Settings** (from Sentry MCP `tsconfig.base.json`):
```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "strict": true,
  "esModuleInterop": true,
  "skipLibCheck": true,
  "resolveJsonModule": true,
  "declaration": true,
  "sourceMap": true
}
```

**Rationale**:
- ES2022 target for modern Node.js features
- ESNext modules for native ESM
- Strict mode catches type errors early
- Declaration files for potential future package publishing

### 10. Tool Implementation Pattern

**Decision**: Follow Sentry MCP's `ToolConfig` pattern with simplified version

**Pattern**:
```typescript
interface ToolConfig<TSchema extends Record<string, z.ZodType>> {
  name: string;
  description: string;
  inputSchema: TSchema;
  handler: (params: z.infer<z.ZodObject<TSchema>>) => Promise<string | Content[]>;
}
```

**Rationale**:
- Type-safe tool definitions
- Zod schema provides both validation and TypeScript types
- Handler returns string or MCP Content array
- Consistent pattern for all tools

**Reference**:
- Sentry MCP `tools/types.ts` and `tools/whoami.ts`

## Dependencies Summary

### Production Dependencies
```json
{
  "@modelcontextprotocol/sdk": "^1.24.0",
  "zod": "^3.25.0"
}
```

### Development Dependencies
```json
{
  "@biomejs/biome": "^1.9.0",
  "@types/node": "^20.0.0",
  "typescript": "^5.6.0",
  "vitest": "^2.0.0"
}
```

## Quality Command

Per constitution requirement (Principle X), single command runs all checks:

```bash
npm run quality
# Runs: test && typecheck && lint && format:check && build
```

## Unresolved Questions

None - all technical decisions are resolved for the hello-world foundation.

## Future Considerations (for mermaid_to_svg)

- Renderer choice: Mermaid CLI, Puppeteer, or Playwright
- Browser automation dependencies
- Timeout handling and resource cleanup
- Test fixture management for diagram sources

These will be researched when implementing the `mermaid_to_svg` tool.
