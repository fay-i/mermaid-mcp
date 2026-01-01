# Implementation Plan: Mermaid to SVG Conversion Tool

**Branch**: `002-mermaid-to-svg` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-mermaid-to-svg/spec.md`

## Summary

Implement core `mermaid_to_svg` MCP tool for converting Mermaid diagram source to SVG. Uses `@mermaid-js/mermaid-cli` with Puppeteer for server-side rendering with deterministic output, configurable themes/backgrounds, and comprehensive error handling with stable error codes.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 24+, ESM modules
**Primary Dependencies**: `@mermaid-js/mermaid-cli` ^11.12.0, `puppeteer` ^23.0.0, `@modelcontextprotocol/sdk`, `zod`
**Storage**: N/A (stateless rendering, temp files cleaned up after each request)
**Testing**: Vitest (unit/behavior), MCP Inspector CLI (integration)
**Target Platform**: Node.js 24+ server
**Project Type**: Single project (MCP server)
**Performance Goals**: Simple flowchart renders in <5s (SC-001), all requests deterministic (SC-003)
**Constraints**: Timeout 1000-120000ms (default 30000), input <1MB (FR-013), within 500ms timeout accuracy (FR-014)
**Scale/Scope**: Single-request processing, resource cleanup after each request

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Epistemic Humility | ✅ PASS | Will trust tool output (Puppeteer, Mermaid errors) |
| II. TDD by Behavior | ✅ PASS | Tests for observable outputs: SVG validation, error codes, timeouts |
| III. CI-First Local | ✅ PASS | `npm run quality` covers all gates |
| IV. No Bypasses | ✅ PASS | No skips, ignores, or disables planned |
| V. Type Policy | ✅ PASS | Strict types for impl, pragmatic for test fixtures |
| VI. Tool Contracts | ✅ PASS | Explicit input/output schemas, stable error codes defined in spec |
| VII. PR Structure | ✅ PASS | Single MCP tool = single PR |
| VIII. Iteration Loop | ✅ PASS | 10-min cycles: test → impl → local gates → push |
| IX. CI in GitHub Actions | ✅ PASS | Same gates, <10 min, no allow-failure |
| X. Local Gates | ✅ PASS | Unit + integration tests mandatory |
| XI. Task Derivation | ✅ PASS | Tasks will derive from this plan via `/speckit.tasks` |

**Constitution Check Result**: ✅ ALL GATES PASS

## Project Structure

### Documentation (this feature)

```text
specs/002-mermaid-to-svg/
├── plan.md              # This file
├── research.md          # Phase 0: Mermaid rendering research
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Usage guide
├── contracts/           # Phase 1: JSON schemas
│   ├── mermaid-to-svg-input.json
│   └── mermaid-to-svg-output.json
└── tasks.md             # Phase 2: /speckit.tasks output
```

### Source Code (repository root)

```text
src/
├── index.ts             # MCP server entry (existing)
├── version.ts           # Version constant (existing)
├── tools/
│   ├── index.ts         # Tool registry (existing, add new tool)
│   ├── types.ts         # Tool type definitions (existing)
│   ├── healthcheck.ts   # Healthcheck tool (existing)
│   └── mermaid-to-svg.ts  # NEW: Mermaid to SVG tool
├── schemas/
│   ├── index.ts         # Schema exports (existing)
│   ├── healthcheck.ts   # Healthcheck schemas (existing)
│   └── mermaid-to-svg.ts  # NEW: Input/output schemas
└── renderer/            # NEW: Mermaid rendering logic
    ├── index.ts         # Renderer facade
    ├── browser.ts       # Browser lifecycle management (launch/close per request)
    └── types.ts         # Renderer-specific types

tests/
├── behavior/            # Behavior tests
│   ├── healthcheck.test.ts  # Existing
│   ├── mermaid-to-svg/      # NEW: Tool behavior tests
│   │   ├── valid-input.test.ts
│   │   ├── error-handling.test.ts
│   │   ├── timeout.test.ts
│   │   └── cleanup.test.ts
│   └── renderer/            # NEW: Renderer unit tests
│       └── determinism.test.ts
└── fixtures/            # Test fixtures
    └── mermaid/         # NEW: Sample Mermaid diagrams
        ├── flowchart.mmd
        ├── sequence.mmd
        ├── class.mmd
        ├── state.mmd
        ├── er.mmd
        ├── gantt.mmd
        ├── pie.mmd
        ├── journey.mmd
        └── invalid-syntax.mmd
```

**Structure Decision**: Single project structure following existing MCP server patterns. New `renderer/` module encapsulates Puppeteer/mermaid-cli integration. Test fixtures provide sample diagrams for all 8 supported types.

## Complexity Tracking

> No Constitution Check violations. Table not applicable.

## Architecture Decisions

### AD-001: Use `@mermaid-js/mermaid-cli` programmatic API

**Decision**: Use the official `renderMermaid` function from `@mermaid-js/mermaid-cli`.

**Rationale**:
- Official package maintained by Mermaid team
- Supports all diagram types and features
- Programmatic Node.js API available
- Proven stability in production

**Trade-off**: API is not semver-covered, but mermaid-cli versioning follows mermaid itself which is well-maintained.

### AD-002: Browser lifecycle per request (no pooling initially)

**Decision**: Launch browser → render → close for each request.

**Rationale**:
- Simpler implementation
- Guarantees resource cleanup (FR-012)
- Guarantees isolation (FR-015)
- Performance is acceptable for expected use

**Future optimization**: If performance becomes an issue, implement browser pooling with TTL.

### AD-003: Deterministic output via mermaid config

**Decision**: Configure mermaid with `deterministicIds: true` and fixed seed.

**Rationale**:
- Mermaid natively supports deterministic IDs
- Same input + options = identical SVG (FR-010, SC-003)

### AD-004: Error code mapping

**Decision**: Map Mermaid/Puppeteer errors to stable error codes defined in spec.

| Error Source | Error Code |
|--------------|------------|
| Empty/missing code | INVALID_INPUT |
| Syntax error in diagram | PARSE_ERROR |
| Unsupported diagram type | UNSUPPORTED_DIAGRAM |
| Invalid config_json | INVALID_CONFIG |
| Invalid timeout value | INVALID_TIMEOUT |
| Input >1MB | INPUT_TOO_LARGE |
| Timeout exceeded | RENDER_TIMEOUT |
| Renderer crash | RENDER_FAILED |

## Dependencies

### Production
- `@mermaid-js/mermaid-cli`: ^11.12.0 (Mermaid rendering)
- `puppeteer`: ^23.0.0 (Headless browser, peer dep of mermaid-cli)

### Existing (from 001-mcp-hello-world)
- `@modelcontextprotocol/sdk`: ^1.24.0
- `zod`: ^3.25.0

### Dev (existing)
- `vitest`, `typescript`, `@biomejs/biome`, `@types/node`
