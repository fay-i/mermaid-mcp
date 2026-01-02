# Implementation Plan: Session-Based Artifact Caching

**Branch**: `007-session-artifact-cache` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-session-artifact-cache/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add disk-based artifact caching to the MCP server with session lifecycle management. Rendered diagrams (SVG, PDF) will be written to a disk cache organized by session ID, with tool responses returning lightweight artifact references instead of large base64-encoded content. The cache supports configurable quotas with LRU eviction, automatic cleanup on session disconnect, and graceful degradation to inline responses when caching is unavailable.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24+ (ESM modules)
**Primary Dependencies**: `@modelcontextprotocol/sdk` ^1.24.0, `zod` ^4.3.4, `puppeteer` ^23.11.1
**Storage**: File system (OS temp directory: `$TMPDIR/mermaid-mcp-cache`)
**Testing**: Vitest (unit), MCP Inspector CLI (integration)
**Target Platform**: Linux/macOS server (Node.js runtime behind supergateway SSE proxy)
**Project Type**: Single project (MCP server library)
**Performance Goals**: Artifact retrieval within 100ms; session cleanup within 5 seconds
**Constraints**: 10GB default quota; 90% response size reduction via references
**Scale/Scope**: Multiple concurrent SSE sessions; artifacts scoped per-session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Epistemic Humility | PASS | All design decisions validated by MCP SDK research |
| II. TDD by Behavior | PASS | User stories define testable behaviors; tests first |
| III. CI-First Local Verification | PASS | Quality gate includes new cache integration tests |
| IV. No Skips/Ignores/Bypasses | PASS | No bypasses planned |
| V. Type Policy | PASS | Strict types in implementation; pragmatic in tests |
| VI. Tool Contract Discipline | PASS | New `fetch_artifact` tool with explicit schemas |
| VII. PR Structure | PASS | Atomic PRs per user story planned |
| VIII. Iteration Loop | PASS | 10-minute cycles with CI feedback |
| IX. CI in GitHub Actions | PASS | Same quality gate as local |
| X. Local Gates | PASS | Integration tests mandatory |
| XI. Task Derivation | PASS | Tasks derived from this plan |

## Project Structure

### Documentation (this feature)

```text
specs/007-session-artifact-cache/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── cache/               # NEW: Cache management module
│   ├── index.ts         # Cache manager exports
│   ├── manager.ts       # CacheManager class (session lifecycle, quota)
│   ├── storage.ts       # File system operations
│   └── types.ts         # Cache types (Artifact, CacheConfig)
├── tools/
│   ├── fetch-artifact.ts  # NEW: Artifact retrieval tool
│   ├── mermaid-to-svg.ts  # MODIFY: Return artifact reference
│   └── mermaid-to-pdf.ts  # MODIFY: Return artifact reference
├── schemas/
│   ├── fetch-artifact.ts  # NEW: Input/output schemas
│   ├── artifact-ref.ts    # NEW: Shared artifact reference schema
│   └── ...
├── renderer/
└── index.ts             # MODIFY: Initialize cache, register fetch_artifact

tests/
├── behavior/
│   ├── cache/           # NEW: Cache behavior tests
│   │   ├── storage.test.ts
│   │   ├── session-isolation.test.ts
│   │   ├── quota-eviction.test.ts
│   │   └── cleanup.test.ts
│   ├── fetch-artifact/  # NEW: fetch_artifact tool tests
│   │   ├── contract.test.ts
│   │   └── errors.test.ts
│   └── mermaid-to-svg/
│       └── cached-output.test.ts  # NEW: Artifact reference tests
└── fixtures/
```

**Structure Decision**: Single project structure maintained. New `src/cache/` module encapsulates all caching logic. Existing tools modified to use cache manager.

## Complexity Tracking

> No violations requiring justification. Design follows existing patterns.

| Aspect | Complexity | Justification |
|--------|------------|---------------|
| Cache module | Low | Single responsibility: file I/O + LRU tracking |
| Session tracking | Low | Uses MCP SDK's built-in `sessionId` from `RequestHandlerExtra` |
| Quota management | Medium | LRU eviction requires metadata tracking per artifact |
