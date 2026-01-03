# Implementation Plan: PDF Deck Builder

**Branch**: `009-pdf-deck-builder` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-pdf-deck-builder/spec.md`

## Summary

Create an MCP tool (`mermaid_to_deck`) that generates a multi-page PDF deck from multiple Mermaid diagrams. Each diagram is rendered to SVG, embedded in an HTML template, converted to PDF via Puppeteer, and combined using pdf-lib. The tool leverages existing rendering infrastructure (`render()` function), S3 storage patterns, and error handling conventions.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24+ (ESM modules)
**Primary Dependencies**: `@modelcontextprotocol/sdk` ^1.24.0, `zod` ^4.3.4, `puppeteer` ^23.11.1, `pdf-lib` ^1.17.1 (dev dep, will move to prod), `@mermaid-js/mermaid-cli` ^11.12.0
**Storage**: S3-compatible (MinIO) via existing `src/storage/s3-client.ts`
**Testing**: Vitest (unit tests), MCP Inspector CLI (integration tests)
**Target Platform**: Linux server (Docker), macOS (development)
**Project Type**: Single MCP server (Node.js library)
**Performance Goals**: 10-page deck in <60 seconds (SC-001), 100-diagram maximum
**Constraints**: 120s max timeout, 10MB max input, 1MB per diagram, 1-hour artifact retention
**Scale/Scope**: Single-user MCP tool, stateless per-request processing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Epistemic Humility | ✅ PASS | Will use Vitest + MCP Inspector CLI to verify behavior |
| II. TDD by Behavior | ✅ PASS | Tests for input validation, rendering, PDF assembly, error handling |
| III. CI-First Local Verification | ✅ PASS | `npm run quality` includes all gates |
| IV. No Skips/Ignores/Bypasses | ✅ PASS | No bypasses planned |
| VI. Tool Contract Discipline | ✅ PASS | Explicit input/output schemas, stable error codes |
| VII. PR Structure | ✅ PASS | Atomic PRs per user story, with remediation checkpoints |
| X. Local Gates | ✅ PASS | Unit + integration tests mandatory |
| XI. Task Derivation | ✅ PASS | Tasks derived from this plan via `/speckit.tasks` |

## Project Structure

### Documentation (this feature)

```text
specs/009-pdf-deck-builder/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0: Architectural decisions ✅
├── data-model.md        # Phase 1: Entity definitions ✅
├── quickstart.md        # Phase 1: Usage examples ✅
├── contracts/
│   └── mermaid-to-deck.json  # Phase 1: JSON schema contract ✅
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── schemas/
│   ├── mermaid-to-deck.ts      # NEW: Input/output schemas for deck tool
│   └── error-codes.ts          # EXISTING: Shared error codes (extend if needed)
├── tools/
│   ├── mermaid-to-deck.ts      # NEW: Main tool implementation
│   ├── deck-renderer.ts        # NEW: Multi-diagram rendering logic
│   └── index.ts                # EXISTING: Tool registry (add new tool)
├── renderer/
│   ├── render.ts               # EXISTING: Single diagram SVG rendering
│   ├── browser.ts              # EXISTING: Puppeteer browser management
│   └── deck-assembler.ts       # NEW: PDF assembly with pdf-lib
├── storage/
│   └── s3-client.ts            # EXISTING: S3 storage (reuse)
└── index.ts                    # EXISTING: MCP server entry

tests/
├── behavior/
│   ├── mermaid-to-deck.test.ts # NEW: Deck tool behavior tests
│   └── deck-assembler.test.ts  # NEW: PDF assembly tests
└── fixtures/
    └── diagrams/               # EXISTING + NEW: Test Mermaid sources
```

**Structure Decision**: Single project layout (Option 1). New files integrate into existing `src/tools/`, `src/schemas/`, and `src/renderer/` directories. Tests follow existing `tests/behavior/` pattern.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitution violations. All checks pass.*

---

## Post-Design Constitution Re-Evaluation

*Verified after Phase 1 design completion.*

| Principle | Status | Post-Design Evidence |
|-----------|--------|---------------------|
| I. Epistemic Humility | ✅ PASS | Design validated against existing POC (`scripts/combine-architecture-pdfs.mjs`) |
| II. TDD by Behavior | ✅ PASS | Behavior tests defined in data-model.md state transitions |
| III. CI-First Local Verification | ✅ PASS | Integration tests via MCP Inspector CLI documented in quickstart.md |
| IV. No Skips/Ignores/Bypasses | ✅ PASS | No bypasses in design |
| VI. Tool Contract Discipline | ✅ PASS | JSON schema contract in `contracts/mermaid-to-deck.json` |
| VII. PR Structure | ✅ PASS | 4 user stories → 4 atomic PRs |
| X. Local Gates | ✅ PASS | `npm run quality` covers all gates |
| XI. Task Derivation | ✅ PASS | Ready for `/speckit.tasks` |

---

## Implementation Phases (from Spec)

### Phase 1: Core Tool Structure (User Story 1)
- Input/output schemas (`src/schemas/mermaid-to-deck.ts`)
- Tool registration in `src/tools/index.ts`
- Basic input validation (diagrams array, size limits)

### Phase 2: Diagram Rendering (User Story 1)
- Browser lifecycle management (reuse pattern from research.md)
- SVG rendering loop using existing `render()` function
- HTML template for pages

### Phase 3: PDF Assembly (User Story 1)
- pdf-lib for page combination
- S3 storage integration
- Response with download URL and page metadata

### Phase 4: Layout Configuration (User Story 2)
- Page size options (letter, A4, legal)
- Orientation support (landscape, portrait)
- Title rendering
- Margin configuration

### Phase 5: Error Handling (User Story 3)
- Diagram-specific error indexing
- Input validation errors
- Timeout handling with cleanup

### Phase 6: URL Access (User Story 4)
- CDN URL inclusion when configured
- Presigned URL generation (existing pattern)
