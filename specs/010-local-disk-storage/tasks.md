# Tasks: Local Disk Storage

**Input**: Design documents from `/specs/010-local-disk-storage/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/storage-backend.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing. Each phase represents a PR checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Storage abstraction types, configuration, and error handling foundation

**PR Scope**: Foundation for all storage backends

- [X] T001 Create StorageBackend interface, StorageResult interface, and StorageErrorCode type in src/storage/types.ts
- [X] T002 [P] Create StorageError base class and specific error subclasses (ArtifactNotFoundError, StorageFullError, StoragePermissionError) in src/storage/errors.ts
- [X] T003 [P] Create Zod schemas for StorageResult validation in src/storage/schemas.ts
- [X] T004 Create storage configuration loader with Zod validation in src/storage/config.ts
- [X] T005 Create unit tests for configuration parsing in tests/behavior/storage/config.test.ts
- [X] T006 Update src/storage/index.ts to export new types and config

**Checkpoint**: Run `npm run quality` — Types compile, config tests pass

**PR**: Create PR for Phase 1, wait for CI + review, remediate, merge before proceeding

---

## Phase 2: User Story 1 - Local Development with Filesystem Storage (Priority: P1) 🎯 MVP

**Goal**: Developers can run MCP server without S3, store artifacts locally, get file:// URLs

**Independent Test**: Start server without S3 credentials → render diagram → verify file:// URL → restart container → verify artifact persists

### Core Implementation for User Story 1

- [X] T007 [US1] Create LocalStorageBackend class implementing StorageBackend in src/storage/local-backend.ts
- [X] T008 [US1] Implement store() with atomic write (temp file + rename) in src/storage/local-backend.ts
- [X] T009 [US1] Implement retrieve() with error handling in src/storage/local-backend.ts
- [X] T010 [P] [US1] Implement delete() with safe removal in src/storage/local-backend.ts
- [X] T011 [P] [US1] Implement exists() with filesystem check in src/storage/local-backend.ts
- [X] T012 [US1] Implement getType() returning 'local' in src/storage/local-backend.ts
- [X] T013 [US1] Implement session directory lazy creation in src/storage/local-backend.ts
- [X] T014 [US1] Implement URL construction using HOST_STORAGE_PATH and LOCAL_URL_SCHEME in src/storage/local-backend.ts
  - LOCAL_URL_SCHEME=file (default): `file://{HOST_STORAGE_PATH}/{session}/{artifact}.{ext}`
  - LOCAL_URL_SCHEME=http: `http://{CDN_HOST}:{CDN_PORT}/artifacts/{session}/{artifact}.{ext}`
- [X] T015 [US1] Implement orphaned .tmp file cleanup on startup in src/storage/local-backend.ts
- [X] T015a [US1] Implement startup write access validation (FR-008) in src/storage/local-backend.ts
  - Create test file on initialization
  - Delete test file after successful write
  - Throw StoragePermissionError if write fails
  - Log success message on validation pass

### Error Handling for User Story 1

- [X] T016 [US1] Handle ENOSPC (disk full) → STORAGE_FULL error in src/storage/local-backend.ts
- [X] T017 [P] [US1] Handle EACCES (permission denied) → PERMISSION_DENIED error in src/storage/local-backend.ts
- [X] T018 [P] [US1] Handle ENOENT (not found) → ARTIFACT_NOT_FOUND error in src/storage/local-backend.ts
- [X] T019 [US1] Add UUID validation for path traversal prevention in src/storage/local-backend.ts

### Tests for User Story 1

- [X] T020 [P] [US1] Unit tests for store() atomic write behavior in tests/behavior/storage/local-backend.test.ts
- [X] T021 [P] [US1] Unit tests for retrieve() and error cases in tests/behavior/storage/local-backend.test.ts
- [X] T022 [P] [US1] Unit tests for delete() and exists() in tests/behavior/storage/local-backend.test.ts
- [X] T023 [P] [US1] Unit tests for URL generation (both file:// and http:// schemes) in tests/behavior/storage/local-backend.test.ts
- [X] T024 [US1] Unit tests for orphaned .tmp cleanup in tests/behavior/storage/local-backend.test.ts
- [X] T024a [US1] Unit test for startup write access validation in tests/behavior/storage/local-backend.test.ts

**Checkpoint**: Run `npm run quality` — All local backend tests pass, no S3 required

**PR**: Create PR for Phase 2 (US1), wait for CI + review, remediate, merge before proceeding

---

## Phase 3: User Story 2 - S3 Storage Configuration (Priority: P2)

**Goal**: Operators can use S3 storage by setting environment variables, seamless backend switching

**Independent Test**: Start server with S3 env vars → render diagram → verify HTTPS URL → switch to local → verify file:// URL

### S3 Backend Wrapper for User Story 2

- [ ] T025 [US2] Create S3StorageBackend class implementing StorageBackend in src/storage/s3-backend.ts
- [ ] T026 [US2] Implement store() wrapping existing S3Storage.storeArtifact() in src/storage/s3-backend.ts
- [ ] T027 [P] [US2] Implement retrieve() wrapping existing S3 download in src/storage/s3-backend.ts
- [ ] T028 [P] [US2] Implement delete() wrapping existing S3 delete in src/storage/s3-backend.ts
- [ ] T029 [P] [US2] Implement exists() using S3 HeadObject in src/storage/s3-backend.ts
- [ ] T030 [US2] Implement getType() returning 's3' in src/storage/s3-backend.ts
- [ ] T031 [US2] Map S3 errors to StorageError codes in src/storage/s3-backend.ts

### Factory and Auto-Detection for User Story 2

- [ ] T032 [US2] Create createStorageBackend() factory function in src/storage/factory.ts
- [ ] T033 [US2] Implement STORAGE_TYPE=local → LocalStorageBackend in src/storage/factory.ts
- [ ] T034 [US2] Implement STORAGE_TYPE=s3 with credential validation in src/storage/factory.ts
- [ ] T035 [US2] Implement STORAGE_TYPE=auto with S3 credential detection in src/storage/factory.ts
- [ ] T036 [US2] Implement auto-detection failure when both configured (FR-011a) in src/storage/factory.ts
- [ ] T037 [US2] Add startup logging for selected backend (FR-009) in src/storage/factory.ts
- [ ] T038 [US2] Update src/storage/index.ts to export factory and S3 backend

### Tests for User Story 2

- [ ] T039 [P] [US2] Unit tests for S3StorageBackend interface compliance in tests/behavior/storage/s3-backend.test.ts
- [ ] T040 [P] [US2] Unit tests for factory backend selection in tests/behavior/storage/factory.test.ts
- [ ] T041 [P] [US2] Unit tests for auto-detection logic in tests/behavior/storage/factory.test.ts
- [ ] T042 [US2] Integration test: S3 backward compatibility in tests/behavior/storage/s3-tool-integration.test.ts
  - Verify: mermaid_to_svg with S3 returns presigned URL (format unchanged)
  - Verify: S3 artifact key format unchanged ({artifact_id}.{ext})
  - Verify: Presigned URL expiration behavior unchanged
  - Verify: S3 error codes map correctly (no new error formats)
  - Verify: Existing env vars still work (S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)

### Tool Updates for User Story 2

- [ ] T043 [US2] Update src/index.ts to use createStorageBackend() factory
- [ ] T044 [US2] Refactor src/tools/mermaid-to-svg.ts to accept StorageBackend parameter
- [ ] T045 [P] [US2] Refactor src/tools/mermaid-to-pdf.ts to accept StorageBackend parameter
- [ ] T046 [P] [US2] Refactor src/tools/mermaid-to-deck.ts to accept StorageBackend parameter
- [ ] T047 [US2] Add storage_type field to tool responses in src/schemas/artifact-output.ts
- [ ] T048 [US2] Integration test: mermaid_to_svg with LocalStorageBackend → file:// URL

**Checkpoint**: Run `npm run quality` — All tests pass, both backends work, tools use abstraction

**PR**: Create PR for Phase 3 (US2), wait for CI + review, remediate, merge before proceeding

---

## Phase 4: User Story 3 - CDN Proxy with Local Files (Priority: P3)

**Goal**: CDN proxy serves artifacts via HTTP regardless of backend (local or S3)

**Independent Test**: Store artifact locally → request via CDN proxy endpoint → verify HTTP 200 with correct content

### CDN Proxy Local File Support for User Story 3

- [ ] T049 [US3] Create local file fetcher in src/cdn-proxy/local-fetcher.ts
- [ ] T050 [US3] Implement GET handler for local file requests in src/cdn-proxy/handlers/local-file-handler.ts
- [ ] T051 [US3] Map URL path to filesystem path with validation in src/cdn-proxy/handlers/local-file-handler.ts
- [ ] T052 [US3] Implement streaming file response in src/cdn-proxy/handlers/local-file-handler.ts (ignore Range headers per FR-013a, always return full content with 200 OK)
- [ ] T053 [P] [US3] Add Content-Type detection from file extension in src/cdn-proxy/handlers/local-file-handler.ts
- [ ] T054 [P] [US3] Add error handling (404, 403, 500) in src/cdn-proxy/handlers/local-file-handler.ts
- [ ] T054a [US3] Verify Range header requests return 200 OK (not 206 Partial) - ignore range headers, return full content

### CDN Proxy Router Updates for User Story 3

- [ ] T055 [US3] Add storage backend detection to CDN proxy startup in src/cdn-proxy/config.ts
- [ ] T056 [US3] Update src/cdn-proxy/router.ts to route based on storage_type
- [ ] T057 [US3] Add X-Storage-Backend header to responses in src/cdn-proxy/router.ts
- [ ] T058 [US3] Update health check to report storage type in src/cdn-proxy/handlers/health.ts

### Tests for User Story 3

- [ ] T059 [P] [US3] Unit tests for local file handler in tests/behavior/cdn-proxy/local-file-handler.test.ts
- [ ] T059a [P] [US3] Unit test: Range header ignored, full content returned with 200 OK
- [ ] T060 [P] [US3] Unit tests for routing logic in tests/behavior/cdn-proxy/router.test.ts
- [ ] T061 [US3] Integration test: CDN proxy serves local files correctly
- [ ] T062 [US3] Integration test: CDN proxy serves S3 files correctly (existing behavior)

**Checkpoint**: Run `npm run quality` — CDN proxy works with both backends

**PR**: Create PR for Phase 4 (US3), wait for CI + review, remediate, merge before proceeding

---

## Phase 5: User Story 4 - Documentation and Package Distribution (Priority: P4)

**Goal**: Users can quickly start via Docker or npm, with clear documentation

**Independent Test**: Follow README instructions → server starts with local storage → render diagram successfully

### Docker Configuration for User Story 4

- [ ] T063 [US4] Add VOLUME definition to Dockerfile for /app/data/artifacts
- [ ] T064 [US4] Create docker-compose.yml with local storage example
- [ ] T065 [P] [US4] Add environment variable comments explaining configuration in docker-compose.yml
- [ ] T066 [US4] Test Docker build with volume definition

### NPM Package Configuration for User Story 4

- [ ] T067 [US4] Add bin configuration for mermaid-mcp CLI in package.json
- [ ] T068 [P] [US4] Add files array for dist, README, LICENSE in package.json
- [ ] T069 [P] [US4] Add publishConfig with public access in package.json
- [ ] T070 [US4] Verify npx execution works locally

### Documentation for User Story 4

- [ ] T071 [US4] Update README.md with Docker setup instructions
- [ ] T072 [P] [US4] Add local development setup instructions to README.md
- [ ] T073 [P] [US4] Add storage configuration reference to README.md
- [ ] T074 [P] [US4] Add troubleshooting section to README.md
- [ ] T075 [US4] Add architecture.mmd exclusion to .gitignore

### Integration Tests for User Story 4

- [ ] T076 [US4] Update scripts/integration-test.sh with local storage tests
- [ ] T077 [US4] End-to-end test: MCP tool → local storage → artifact retrieval
- [ ] T078 [US4] End-to-end test: docker-compose up → render → verify artifact

**Checkpoint**: Run `npm run quality` — Documentation complete, Docker works, package ready

**PR**: Create PR for Phase 5 (US4), wait for CI + review, remediate, merge before proceeding

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and architecture documentation

- [ ] T079 Review all changes for consistency and code style
- [ ] T080 [P] Verify test coverage >90% for storage module
- [ ] T081 [P] Add JSDoc comments to all public interfaces
- [ ] T082 Run full quality gate from clean slate (npm run clean && npm install && npm run quality)
- [ ] T083 Run quickstart.md validation scenarios manually
- [ ] T084 Generate architecture.mmd using MCP server itself (self-test)
- [ ] T085 Security review: verify path traversal prevention
- [ ] T086 Performance validation: local storage <100ms for <1MB files

**Checkpoint**: Run `npm run quality` — All checks pass, feature complete

**PR**: Create PR for Phase 6 (Polish), wait for CI + review, remediate, merge

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    │
    ▼
Phase 2 (US1: Local Storage) ─── MVP Complete
    │
    ▼
Phase 3 (US2: S3 Backend + Factory)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 4 (US3: CDN)   Phase 5 (US4: Docs)
    │                  │
    └────────┬─────────┘
             ▼
      Phase 6 (Polish)
```

### User Story Independence

| Story | Dependencies | Can Start After |
|-------|--------------|-----------------|
| US1 (Local Storage) | Phase 1 only | Phase 1 complete |
| US2 (S3 Backend) | US1 (abstraction layer) | Phase 2 complete |
| US3 (CDN Proxy) | US2 (factory function) | Phase 3 complete |
| US4 (Documentation) | US2 (both backends) | Phase 3 complete |

### PR Workflow (MANDATORY)

```text
Phase 1 → PR → Review → Merge → STOP
Phase 2 (US1) → PR → Review → Merge → STOP  ← MVP CHECKPOINT
Phase 3 (US2) → PR → Review → Merge → STOP
Phase 4 (US3) → PR → Review → Merge → STOP
Phase 5 (US4) → PR → Review → Merge → STOP
Phase 6 (Polish) → PR → Review → Merge → DONE
```

---

## Parallel Opportunities

### Phase 1 Parallel Tasks
```bash
# Can run simultaneously:
T002: storage error classes
T003: StorageResult interface
```

### Phase 2 (US1) Parallel Tasks
```bash
# After T007-T009:
T010, T011: delete() and exists()
T016, T017, T018: error handlers
T020-T024: all unit tests (after implementation)
```

### Phase 3 (US2) Parallel Tasks
```bash
# After T025-T026:
T027, T028, T029: retrieve/delete/exists
T039, T040, T041: unit tests
T044, T045, T046: tool refactors
```

### Phase 4 (US3) Parallel Tasks
```bash
# After T049-T052:
T053, T054: Content-Type and error handling
T059, T060: unit tests
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types, config)
2. Complete Phase 2: User Story 1 (local storage)
3. **STOP and VALIDATE**: Test local storage independently
4. Deploy/demo MVP if ready

### Full Implementation

1. Phase 1 → Foundation ready
2. Phase 2 → MVP: Local storage works standalone
3. Phase 3 → Both backends work, seamless switching
4. Phase 4 + Phase 5 (can parallel) → CDN + Docs
5. Phase 6 → Polish and ship

---

## Task Summary

| Phase | User Story | Task Count | Parallel Tasks |
|-------|------------|------------|----------------|
| 1 | Setup | 6 | 2 |
| 2 | US1 (Local Storage) | 18 | 10 |
| 3 | US2 (S3 Backend) | 18 | 9 |
| 4 | US3 (CDN Proxy) | 14 | 6 |
| 5 | US4 (Documentation) | 16 | 6 |
| 6 | Polish | 8 | 2 |
| **Total** | | **80** | **35** |
