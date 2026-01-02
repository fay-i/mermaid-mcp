# Implementation Plan: Mermaid to PDF Tool

**Branch**: `003-mermaid-to-pdf` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-mermaid-to-pdf/spec.md`

## Summary

Add a new `mermaid_to_pdf` MCP tool that leverages the existing `mermaid_to_svg` rendering pipeline to produce vector PDF documents from Mermaid diagram source code. The tool will render Mermaid → inline SVG in an HTML page, then use Puppeteer's native `page.pdf()` to generate the PDF. This approach requires **no new dependencies** and preserves vector graphics quality.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24+ (ESM modules)
**Primary Dependencies**: `@modelcontextprotocol/sdk`, `zod`, `puppeteer`, `mermaid` (all existing)
**New Dependencies**: None (Puppeteer's native `page.pdf()` used instead of jspdf/svg2pdf.js)
**Storage**: N/A (stateless tool, base64 output)
**Testing**: Vitest (unit), MCP Inspector CLI (integration)
**Target Platform**: Node.js server (MCP stdio transport)
**Project Type**: Single project (MCP server)
**Performance Goals**: Same as mermaid_to_svg (~5s typical render)
**Constraints**: 30s default timeout (1-120s configurable), 1MB max input, vector PDF output
**Scale/Scope**: Single MCP tool, extends existing rendering pipeline

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates (Constitution v1.2.0)

| Principle | Gate | Status |
|-----------|------|--------|
| II. TDD by Behavior | Tests define behavior first, implementation follows | PASS - Spec defines acceptance scenarios with clear behavior assertions |
| III. CI-First Local Verification | Clean Slate Protocol before every push | PASS - `npm run quality` runs all gates |
| IV. No Skips/Bypasses | No test.skip, @ts-ignore, eslint-disable | PASS - Will enforce during implementation |
| VI. Tool Contract Discipline | Explicit input/output schemas, stable error codes | PASS - Spec defines schemas and error codes (including PDF_GENERATION_FAILED) |
| VII. PR Structure | Atomic PRs (one tool per PR) | PASS - Single mermaid_to_pdf tool |
| X. Local Gates | Typecheck, lint, format, build, test, integration test | PASS - Same gates as existing tools |
| XI. Task Derivation | Tasks derived from plan, not invented | PASS - Tasks will follow this plan |

### Potential Concerns (Pre-Research)

- **New dependency addition** (jspdf, svg2pdf.js): Must verify library compatibility with ESM/Node.js 24+ and check for vulnerabilities
- **Resource cleanup**: Must ensure PDF conversion cleans up intermediate resources
- **Determinism**: Must verify same input produces identical PDF output

All NON-NEGOTIABLE principles (I, II, III, IV, VII, VIII, X) can be satisfied. No violations requiring justification.

### Post-Design Gates (After Research)

Research resolved all concerns:

| Concern | Resolution | Status |
|---------|------------|--------|
| New dependencies (jspdf, svg2pdf.js) | **NOT NEEDED** - Puppeteer's `page.pdf()` handles SVG→PDF natively | RESOLVED |
| ESM compatibility | N/A - using only existing dependencies | RESOLVED |
| Resource cleanup | Same pattern as mermaid_to_svg (browser lifecycle management) | RESOLVED |
| Determinism | Chrome PDF engine is deterministic for same input | RESOLVED |
| Vector quality | Inline SVGs are preserved as vector paths by Chrome's PDF engine | RESOLVED |

**Key Research Finding**: jspdf/svg2pdf.js have ESM compatibility issues with Node.js ([GitHub Issue #3835](https://github.com/parallax/jsPDF/issues/3835)). Puppeteer's native `page.pdf()` is simpler, uses existing dependencies, and produces vector PDFs.

## Project Structure

### Documentation (this feature)

```text
specs/003-mermaid-to-pdf/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── mermaid-to-pdf.json  # OpenAPI-style schema
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── index.ts              # MCP server entry point (existing)
├── version.ts            # Version constant (existing)
├── renderer/             # Mermaid rendering logic (existing)
│   ├── index.ts
│   ├── browser.ts
│   ├── render.ts
│   └── types.ts
├── schemas/              # JSON schemas for tool I/O
│   ├── mermaid-to-svg.ts # Existing SVG schema
│   └── mermaid-to-pdf.ts # NEW: PDF schema (extends SVG patterns)
└── tools/                # MCP tool implementations
    ├── index.ts          # Tool registry (update to include PDF)
    ├── types.ts          # ToolConfig type (existing)
    ├── healthcheck.ts    # Existing healthcheck tool
    ├── mermaid-to-svg.ts # Existing SVG tool (reference pattern)
    └── mermaid-to-pdf.ts # NEW: PDF tool implementation

tests/
├── behavior/
│   ├── healthcheck.test.ts
│   ├── server.test.ts
│   ├── mermaid-to-svg/     # Existing SVG tests (pattern reference)
│   │   ├── cleanup.test.ts
│   │   ├── edge-cases.test.ts
│   │   ├── error-handling.test.ts
│   │   ├── schema-validation.test.ts
│   │   └── timeout.test.ts
│   ├── mermaid-to-pdf/     # NEW: PDF behavior tests
│   │   ├── contract.test.ts        # Input/output contract validation
│   │   ├── error-handling.test.ts  # Error code mapping
│   │   ├── pdf-validation.test.ts  # Vector quality verification
│   │   └── timeout.test.ts         # Timeout and cleanup
│   └── renderer/
│       └── determinism.test.ts
└── fixtures/
    └── mermaid/            # Existing Mermaid test fixtures
```

**Structure Decision**: Single project structure matching existing codebase. New PDF tool follows the exact patterns established by `mermaid_to_svg`:
- Schema in `src/schemas/mermaid-to-pdf.ts`
- Tool in `src/tools/mermaid-to-pdf.ts`
- Tests in `tests/behavior/mermaid-to-pdf/`

## Complexity Tracking

No violations requiring justification. The implementation:
- Reuses existing patterns (no new abstractions)
- **Adds NO new dependencies** (uses Puppeteer's native `page.pdf()`)
- Follows established tool structure exactly

## Implementation Approach

Based on research findings (see [research.md](./research.md)):

### Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Validate   │ →  │  Render SVG  │ →  │  Embed in    │ →  │  page.pdf()  │
│    Input     │    │  (existing)  │    │    HTML      │    │  (Puppeteer) │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Key Implementation Details

1. **Reuse existing validation** - same as mermaid_to_svg
2. **Reuse SVG rendering** - existing `render()` function
3. **Embed SVG in HTML** - inline SVG in minimal HTML document
4. **Generate PDF** - Puppeteer `page.pdf()` with dimensions matching SVG
5. **Base64 encode** - for MCP transport

### Error Code Extension

Add new error code to existing schema:
```typescript
// In src/schemas/mermaid-to-pdf.ts
export const PdfErrorCodeSchema = z.enum([
  ...ErrorCodeSchema.options,  // All SVG error codes
  "PDF_GENERATION_FAILED",     // NEW: SVG succeeded but PDF failed
]);
```

## Artifacts Generated

| File | Purpose |
|------|---------|
| `research.md` | Research findings and architecture decisions |
| `data-model.md` | Entity definitions and validation rules |
| `contracts/mermaid-to-pdf.json` | JSON Schema contract |
| `quickstart.md` | Usage guide and examples |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
