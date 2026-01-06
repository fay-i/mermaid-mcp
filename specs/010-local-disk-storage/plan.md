# Implementation Plan: Local Disk Storage

**Branch**: `010-local-disk-storage` | **Date**: January 6, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-local-disk-storage/spec.md`

## Summary

Enable local filesystem storage as the default storage option for Mermaid MCP server artifacts. The storage abstraction layer allows both local filesystem and S3 backends, with auto-detection defaulting to local when S3 credentials are absent. Artifacts are stored in session-organized directories with atomic writes, and URLs use file:// scheme with host-resolvable paths. This removes the S3 dependency for local development and testing scenarios, including generating architecture documents with the MCP itself.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24+ (ESM modules)
**Primary Dependencies**: `@modelcontextprotocol/sdk` ^1.24.0, `zod` ^4.3.5, `puppeteer` ^23.11.1, `@aws-sdk/client-s3` ^3.962.0 (existing)
**Storage**: Local filesystem (`fs/promises`) primary, S3/MinIO optional
**Testing**: Vitest (unit), MCP Inspector CLI (integration)
**Target Platform**: Linux container (Docker), macOS/Linux local development
**Project Type**: Single project - MCP server
**Performance Goals**: CDN proxy <100ms response for files <1MB (SC-005)
**Constraints**: Zero breaking changes to existing S3 deployments (SC-006)
**Scale/Scope**: Single-server deployment, artifacts persist indefinitely

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. Epistemic Humility | ✅ PASS | Will run `npm run quality` before every push |
| II. TDD by Behavior | ✅ PASS | Tests defined for each user story before implementation |
| III. CI-First Local Verification | ✅ PASS | Clean Slate Protocol in quickstart.md |
| IV. No Skips/Ignores/Bypasses | ✅ PASS | No exceptions planned |
| V. Type Policy | ✅ PASS | Strict types for implementation, pragmatic for tests |
| VI. Tool Contract Discipline | ✅ PASS | Contracts defined in contracts/storage-backend.md |
| VII. PR Structure | ✅ PASS | One PR per user story, atomic scope |
| VIII. Iteration Loop | ✅ PASS | 10-minute cycles documented |
| X. Local Gates | ✅ PASS | `npm run quality` includes unit + integration tests |

## Project Structure

### Documentation (this feature)

```text
specs/010-local-disk-storage/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
├── quickstart.md        # Phase 1 output ✅
├── contracts/           # Phase 1 output ✅
│   └── storage-backend.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── storage/
│   ├── index.ts              # Re-exports (UPDATE: add new exports)
│   ├── types.ts              # NEW: StorageBackend interface, StorageResult, errors
│   ├── local-backend.ts      # NEW: LocalStorageBackend implementation
│   ├── s3-backend.ts         # NEW: S3StorageBackend (wrapper around existing S3Storage)
│   ├── factory.ts            # NEW: createStorageBackend factory
│   ├── config.ts             # NEW: loadStorageConfig
│   ├── s3-client.ts          # EXISTING: Keep for S3StorageBackend internal use
│   └── s3-config.ts          # EXISTING: Keep for backward compatibility
├── cdn-proxy/
│   ├── handlers/
│   │   ├── artifact.ts       # UPDATE: Add local file serving
│   │   └── health.ts         # UPDATE: Report storage type
│   ├── config.ts             # UPDATE: Add storage backend detection
│   └── local-fetcher.ts      # NEW: Local file fetcher
├── tools/
│   ├── mermaid-to-svg.ts     # UPDATE: Use StorageBackend interface
│   ├── mermaid-to-pdf.ts     # UPDATE: Use StorageBackend interface
│   └── mermaid-to-deck.ts    # UPDATE: Use StorageBackend interface
└── index.ts                  # UPDATE: Use createStorageBackend factory

tests/
├── behavior/
│   └── storage/
│       ├── s3-config.test.ts       # EXISTING
│       ├── s3-tool-integration.test.ts  # EXISTING
│       ├── local-backend.test.ts   # NEW: LocalStorageBackend tests
│       ├── s3-backend.test.ts      # NEW: S3StorageBackend tests
│       ├── factory.test.ts         # NEW: Backend selection tests
│       └── config.test.ts          # NEW: Configuration tests
└── fixtures/
    └── mermaid/                    # EXISTING test fixtures
```

**Structure Decision**: Single project structure maintained. New storage abstraction files added under `src/storage/`. Tests follow existing `tests/behavior/` pattern with domain subdirectories.

## Implementation Phases

### Phase 1: Storage Abstraction Layer (User Story 1 foundation)

**Deliverables**: StorageBackend interface, error types, configuration module

**Files**:
1. `src/storage/types.ts` - StorageBackend interface, StorageResult type, StorageErrorCode type
2. `src/storage/errors.ts` - StorageError base class and subclasses
3. `src/storage/schemas.ts` - Zod schemas for runtime validation
4. `src/storage/config.ts` - Configuration loader with validation
5. `tests/behavior/storage/config.test.ts` - Config validation tests

**Behavior Tests**:
- Valid config with STORAGE_TYPE=local → LocalStorageConfig returned
- Valid config with STORAGE_TYPE=s3 → S3StorageConfig returned
- Missing S3 credentials when STORAGE_TYPE=s3 → ConfigurationError
- Both configured with STORAGE_TYPE=auto → ConfigurationError (FR-011a)

### Phase 2: Local Storage Backend (User Story 1 core)

**Deliverables**: LocalStorageBackend implementation with atomic writes

**Files**:
1. `src/storage/local-backend.ts` - LocalStorageBackend class
2. `tests/behavior/storage/local-backend.test.ts` - Behavior tests

**Behavior Tests**:
- store() creates session directory if not exists
- store() writes atomically (no .tmp on success)
- store() returns file:// URL with HOST_STORAGE_PATH
- retrieve() returns exact stored content
- retrieve() throws ArtifactNotFoundError for missing file
- delete() removes artifact file
- exists() returns true for existing, false for missing
- getType() returns 'local'
- Startup cleans orphaned .tmp files (FR-007a)
- Disk full error → STORAGE_FULL code (FR-015)
- Invalid UUID → path traversal prevention

### Phase 3: S3 Storage Backend Wrapper (User Story 2 foundation)

**Deliverables**: S3StorageBackend implementing StorageBackend interface

**Files**:
1. `src/storage/s3-backend.ts` - Wrapper around existing S3Storage
2. `tests/behavior/storage/s3-backend.test.ts` - Interface compliance tests

**Behavior Tests**:
- store() delegates to S3Storage.storeArtifact()
- store() returns StorageResult with storage_type='s3'
- retrieve() fetches from S3
- getType() returns 's3'
- S3 errors mapped to StorageError codes

### Phase 4: Backend Factory (User Stories 1 & 2)

**Deliverables**: Factory function with auto-detection logic

**Files**:
1. `src/storage/factory.ts` - createStorageBackend function
2. `src/storage/index.ts` - Updated exports
3. `tests/behavior/storage/factory.test.ts` - Selection logic tests

**Behavior Tests**:
- STORAGE_TYPE=local → LocalStorageBackend
- STORAGE_TYPE=s3 with credentials → S3StorageBackend
- STORAGE_TYPE=s3 without credentials → ConfigurationError
- STORAGE_TYPE=auto with S3 → S3StorageBackend
- STORAGE_TYPE=auto without S3 → LocalStorageBackend
- STORAGE_TYPE=auto with both → ConfigurationError
- Startup logging shows selected backend (FR-009)

### Phase 5: Tool Updates (User Stories 1 & 2)

**Deliverables**: Tools use StorageBackend interface

**Files**:
1. `src/index.ts` - Use createStorageBackend()
2. `src/tools/mermaid-to-svg.ts` - Accept StorageBackend parameter
3. `src/tools/mermaid-to-pdf.ts` - Accept StorageBackend parameter
4. `src/tools/mermaid-to-deck.ts` - Accept StorageBackend parameter (if applicable)

**Behavior Tests**:
- mermaid_to_svg with LocalStorageBackend → file:// URL
- mermaid_to_svg with S3StorageBackend → https:// URL
- mermaid_to_pdf with LocalStorageBackend → file:// URL
- Response includes storage_type field

### Phase 6: CDN Proxy Updates (User Story 3)

**Deliverables**: CDN proxy serves local files

**Files**:
1. `src/cdn-proxy/local-fetcher.ts` - Local file reading utility
2. `src/cdn-proxy/handlers/local-file-handler.ts` - NEW: Handler for local storage requests
3. `src/cdn-proxy/handlers/artifact.ts` - UPDATE: Add routing logic to dispatch to local or S3 handler
4. `src/cdn-proxy/handlers/health.ts` - UPDATE: Report storage type
5. `src/cdn-proxy/config.ts` - UPDATE: Detect storage backend at startup

**Behavior Tests**:
- GET /artifacts/{session}/{artifact}.svg → local file content (FR-013)
- GET /artifacts/... for missing file → 404 (FR-013)
- GET /health → includes storage.type field
- Content-Type header correct for SVG and PDF
- Full download only, no range requests (FR-013a)

### Phase 7: Docker & Documentation (User Story 4)

**Deliverables**: Docker configuration, README updates, package.json for npm

**Files**:
1. `Dockerfile` - Add volume definition
2. `docker-compose.yml` - NEW: Example compose file
3. `README.md` - Docker and local setup instructions
4. `package.json` - Add bin, files, publishConfig for npm

**Acceptance Tests**:
- Docker build succeeds
- Container starts with local storage configured
- Volume mount persists across restarts
- `npm pack` creates installable package
- `npx @fay-i/mermaid-mcp` starts server (after publish)

### Phase 8: Integration & Architecture (User Story 4 completion)

**Deliverables**: Integration tests, architecture diagram

**Files**:
1. `scripts/integration-test.sh` - Update with storage tests
2. `architecture.mmd` - NEW: Mermaid diagram (gitignored per FR-020)
3. `.gitignore` - Add architecture.mmd

**Integration Tests**:
- End-to-end with local storage: render → store → retrieve
- End-to-end with S3 storage: render → store → retrieve
- CDN proxy with local storage
- CDN proxy with S3 storage

## User Story to Phase Mapping

| User Story | Phases | PR Scope |
|------------|--------|----------|
| US1: Local Development | 1, 2, 4, 5 | Foundation + local storage |
| US2: S3 Configuration | 3, 4 (partial), 5 (partial) | S3 backend wrapper |
| US3: CDN Proxy | 6 | CDN local file serving |
| US4: Documentation | 7, 8 | Docker, npm, docs |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking S3 deployments | Comprehensive tests for existing S3 behavior |
| File permission issues | Startup validation, clear error messages |
| Path traversal attacks | UUID validation, no user input in paths |
| Partial writes on crash | Atomic write pattern (temp + rename) |

## Testing Use Case: Architecture Documents

Per user request, we'll test local storage by generating architecture documents with the MCP:

```bash
# After implementation, generate storage architecture diagram
STORAGE_TYPE=local \
LOCAL_STORAGE_PATH=/tmp/artifacts \
HOST_STORAGE_PATH=/tmp/artifacts \
node dist/index.js &

# Call mermaid_to_svg via MCP Inspector
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_svg \
  --tool-arg code="$(cat architecture.mmd)"

# Verify: file exists at returned file:// URL
```

This validates the complete flow: MCP server → StorageBackend → local filesystem → file:// URL response.

## Next Steps

1. Run `/speckit.tasks` to generate task breakdown
2. Create PR for Phase 1-2 (User Story 1)
3. Follow iteration loop: test → implement → quality → push → review
