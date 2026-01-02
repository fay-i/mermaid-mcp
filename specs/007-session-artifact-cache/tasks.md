# Tasks: Session-Based Artifact Caching

**Input**: Design documents from `/specs/007-session-artifact-cache/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Following TDD methodology per CLAUDE.md - tests are written first and must fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and cache module structure

- [ ] T001 Create cache module directory structure per plan.md in src/cache/
- [ ] T002 [P] Create cache types and interfaces in src/cache/types.ts (Artifact, CacheConfig, SessionMeta, ArtifactRef per data-model.md)
- [ ] T003 [P] Create artifact reference schema in src/schemas/artifact-ref.ts (per contracts/artifact-reference.json)
- [ ] T004 [P] Add environment variable configuration loader for cache settings in src/cache/config.ts (MERMAID_CACHE_DIR, MERMAID_CACHE_QUOTA_GB, MERMAID_CACHE_ENABLED per research.md Decision 7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core cache infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Storage Layer

- [ ] T005 Behavior test for file system write operations in tests/behavior/cache/storage.test.ts (write artifact, verify file exists)
- [ ] T006 Behavior test for file system read operations in tests/behavior/cache/storage.test.ts (read artifact, verify content)
- [ ] T007 Behavior test for directory creation/cleanup in tests/behavior/cache/storage.test.ts (create session dir, delete session dir)
- [ ] T008 Implement storage module with write/read/delete operations in src/cache/storage.ts (per research.md Decision 3)

### Cache Manager Core

- [ ] T009 Behavior test for cache manager initialization in tests/behavior/cache/manager.test.ts (FR-013: clears entire cache directory on startup to remove orphaned artifacts per research.md Decision 8)
- [ ] T010 Behavior test for artifact metadata tracking in tests/behavior/cache/manager.test.ts (track size, content type, paths)
- [ ] T011 Implement CacheManager class core structure in src/cache/manager.ts (initialization, config loading, directory setup)
- [ ] T012 Export cache module public API in src/cache/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Render Diagram with Cached Output (Priority: P1) MVP

**Goal**: Modify `mermaid_to_svg` and `mermaid_to_pdf` to write artifacts to disk cache and return artifact references instead of inline content

**Independent Test**: Call `mermaid_to_svg`, verify response contains artifact reference (URI and ID) instead of inline base64 content, verify file exists on disk

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Contract test for mermaid_to_svg cached output schema in tests/behavior/mermaid-to-svg/cached-output.test.ts (artifact reference fields per contracts/mermaid-to-svg-cached.json)
- [ ] T014 [P] [US1] Contract test for mermaid_to_pdf cached output schema in tests/behavior/mermaid-to-pdf/cached-output.test.ts (artifact reference fields per contracts/mermaid-to-pdf-cached.json)
- [ ] T015 [P] [US1] Behavior test for artifact file creation in tests/behavior/mermaid-to-svg/cached-output.test.ts (file exists at URI path after render)

### Implementation for User Story 1

- [ ] T016 [US1] Add session ID extraction helper using MCP SDK RequestHandlerExtra in src/cache/session.ts (per research.md Decision 1)
- [ ] T017 [US1] Implement writeArtifact method in CacheManager in src/cache/manager.ts (generate UUID, write to session directory, return ArtifactRef)
- [ ] T018 [US1] Update mermaid_to_svg output schema to support artifact reference in src/schemas/mermaid-to-svg.ts (add artifact, mode, warnings, errors fields per contracts/mermaid-to-svg-cached.json)
- [ ] T019 [US1] Modify mermaid_to_svg handler to use cache and return artifact reference in src/tools/mermaid-to-svg.ts
- [ ] T020 [US1] Update mermaid_to_pdf output schema to support artifact reference in src/schemas/mermaid-to-pdf.ts (add artifact, mode, warnings, errors fields per contracts/mermaid-to-pdf-cached.json)
- [ ] T021 [US1] Modify mermaid_to_pdf handler to use cache and return artifact reference in src/tools/mermaid-to-pdf.ts
- [ ] T022 [US1] Update MCP server initialization to create CacheManager in src/index.ts

**Checkpoint**: User Story 1 complete - diagram rendering returns artifact references, files exist on disk

---

## Phase 4: User Story 2 - Fetch Cached Artifact (Priority: P1)

**Goal**: Implement `fetch_artifact` tool to retrieve cached artifacts by ID

**Independent Test**: Render a diagram, call `fetch_artifact` with the returned artifact ID, verify content matches original render

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023 [P] [US2] Contract test for fetch_artifact success response in tests/behavior/fetch-artifact/contract.test.ts (per contracts/fetch-artifact.json)
- [ ] T024 [P] [US2] Contract test for fetch_artifact with base64 encoding in tests/behavior/fetch-artifact/contract.test.ts
- [ ] T025 [P] [US2] Contract test for fetch_artifact with utf8 encoding in tests/behavior/fetch-artifact/contract.test.ts
- [ ] T026 [P] [US2] Error test for fetch_artifact ARTIFACT_NOT_FOUND in tests/behavior/fetch-artifact/errors.test.ts
- [ ] T027 [P] [US2] Error test for fetch_artifact INVALID_ARTIFACT_ID in tests/behavior/fetch-artifact/errors.test.ts

### Implementation for User Story 2

- [ ] T028 [US2] Create fetch_artifact input schema in src/schemas/fetch-artifact.ts (artifact_id, encoding per contracts/fetch-artifact.json)
- [ ] T029 [US2] Create fetch_artifact output schema in src/schemas/fetch-artifact.ts (success and error responses)
- [ ] T030 [US2] Implement getArtifact method in CacheManager in src/cache/manager.ts (lookup by ID, update lastAccessedAt, return content)
- [ ] T031 [US2] Implement fetch_artifact tool handler in src/tools/fetch-artifact.ts
- [ ] T032 [US2] Register fetch_artifact tool in MCP server in src/index.ts

**Checkpoint**: User Story 2 complete - artifacts can be retrieved by ID with correct encoding

---

## Phase 5: User Story 3 - Session Isolation (Priority: P2)

**Goal**: Ensure artifacts are scoped to the creating session and cannot be accessed by other sessions

**Independent Test**: Create artifacts in session A, attempt to fetch from session B, verify SESSION_MISMATCH error

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T033 [P] [US3] Behavior test for session-scoped artifact storage in tests/behavior/cache/session-isolation.test.ts (artifact stored in session directory)
- [ ] T034 [P] [US3] Error test for SESSION_MISMATCH when fetching from wrong session in tests/behavior/cache/session-isolation.test.ts

### Implementation for User Story 3

- [ ] T035 [US3] Add session validation to getArtifact method in src/cache/manager.ts (compare requestSessionId with artifact's sessionId)
- [ ] T036 [US3] Implement SESSION_MISMATCH error response in fetch_artifact handler in src/tools/fetch-artifact.ts

**Checkpoint**: User Story 3 complete - cross-session artifact access is denied

---

## Phase 6: User Story 4 - Session Cleanup (Priority: P2)

**Goal**: Automatically clean up artifacts when a session disconnects or times out

**Independent Test**: Create artifacts in a session, simulate session disconnect/timeout, verify artifacts are removed from disk

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T037 [P] [US4] Behavior test for session cleanup on timeout in tests/behavior/cache/cleanup.test.ts (artifacts deleted after session timeout)
- [ ] T038 [P] [US4] Behavior test for session directory deletion in tests/behavior/cache/cleanup.test.ts (no files remain after cleanup)
- [ ] T039 [P] [US4] Behavior test for cleanup on server shutdown in tests/behavior/cache/cleanup.test.ts (SIGTERM/SIGINT triggers cleanup)

### Implementation for User Story 4

- [ ] T040 [US4] Track session last activity time in CacheManager in src/cache/manager.ts (update on every artifact write/read)
- [ ] T041 [US4] Implement cleanupSession method in CacheManager in src/cache/manager.ts (delete session directory and metadata)
- [ ] T042 [US4] Implement periodic orphan session cleanup in CacheManager in src/cache/manager.ts (per research.md Decision 2)
- [ ] T043 [US4] Add shutdown handlers for graceful cleanup in src/index.ts (SIGTERM, SIGINT per research.md Decision 2)

**Checkpoint**: User Story 4 complete - sessions are cleaned up on disconnect/timeout

---

## Phase 7: User Story 5 - Storage Quota Management (Priority: P3)

**Goal**: Enforce storage quota with LRU eviction when approaching limit

**Independent Test**: Fill cache to quota, add new artifact, verify least recently accessed artifact was evicted

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T044 [P] [US5] Behavior test for LRU eviction when quota exceeded in tests/behavior/cache/quota-eviction.test.ts (oldest artifact evicted)
- [ ] T045 [P] [US5] Behavior test for eviction to 90% quota in tests/behavior/cache/quota-eviction.test.ts (per research.md Decision 5)
- [ ] T046 [P] [US5] Behavior test for quota tracking accuracy in tests/behavior/cache/quota-eviction.test.ts (totalSizeBytes matches sum of artifacts)

### Implementation for User Story 5

- [ ] T047 [US5] Implement global size tracking in CacheManager in src/cache/manager.ts (update on write, delete)
- [ ] T048 [US5] Implement LRU index sorted by lastAccessedAt in src/cache/manager.ts (per research.md Decision 5)
- [ ] T049 [US5] Implement evictLRU method in CacheManager in src/cache/manager.ts (evict until below 90% quota)
- [ ] T050 [US5] Integrate eviction check into writeArtifact method in src/cache/manager.ts

**Checkpoint**: User Story 5 complete - cache respects quota with automatic LRU eviction

---

## Phase 8: User Story 6 - Graceful Degradation (Priority: P3)

**Goal**: Fall back to inline responses when caching is unavailable

**Independent Test**: Make cache directory unwritable, render diagram, verify inline content is returned with warning

### Tests for User Story 6

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T051 [P] [US6] Behavior test for inline fallback when sessionId undefined in tests/behavior/mermaid-to-svg/fallback.test.ts (per research.md Decision 1)
- [ ] T052 [P] [US6] Behavior test for inline fallback when cache disabled in tests/behavior/mermaid-to-svg/fallback.test.ts
- [ ] T053 [P] [US6] Behavior test for inline fallback with CACHE_UNAVAILABLE warning in tests/behavior/mermaid-to-svg/fallback.test.ts

### Implementation for User Story 6

- [ ] T054 [US6] Add cache availability check method in CacheManager in src/cache/manager.ts (isAvailable: check enabled, writable, sessionId)
- [ ] T055 [US6] Update mermaid_to_svg to fall back to inline when cache unavailable in src/tools/mermaid-to-svg.ts (per research.md Decision 6)
- [ ] T056 [US6] Update mermaid_to_pdf to fall back to inline when cache unavailable in src/tools/mermaid-to-pdf.ts
- [ ] T057 [US6] Add CACHE_UNAVAILABLE warning to fallback responses in src/tools/mermaid-to-svg.ts and src/tools/mermaid-to-pdf.ts

**Checkpoint**: User Story 6 complete - server remains functional when caching fails

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, documentation, and quality assurance

- [ ] T058 [P] Integration test for full render-fetch cycle in tests/integration/cache-lifecycle.test.ts (via MCP Inspector CLI)
- [ ] T059 [P] Integration test for session cleanup in tests/integration/cache-lifecycle.test.ts
- [ ] T060 [P] Update quickstart.md with cache configuration examples in specs/007-session-artifact-cache/quickstart.md
- [ ] T061 Run full quality gate (npm run quality) and verify all tests pass
- [ ] T062 Update Dockerfile if cache directory needs volume mount configuration in Dockerfile

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - US1 + US2 are both P1 - can proceed in parallel after Phase 2
  - US3 + US4 are both P2 - can proceed in parallel after Phase 2
  - US5 + US6 are both P3 - can proceed in parallel after Phase 2
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 2 - May use US1 artifacts for testing but independently testable
- **User Story 3 (P2)**: Can start after Phase 2 - Extends fetch_artifact behavior (builds on US2)
- **User Story 4 (P2)**: Can start after Phase 2 - Extends CacheManager (independent of US1-US3)
- **User Story 5 (P3)**: Can start after Phase 2 - Extends CacheManager (independent of other stories)
- **User Story 6 (P3)**: Can start after Phase 2 - Extends render tools (builds on US1)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schemas before handlers
- CacheManager methods before tool handlers
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003, T004)
- All Foundational test tasks marked [P] can run in parallel within Phase 2
- US1 and US2 can be worked on in parallel after Foundational phase
- US3 and US4 can be worked on in parallel
- US5 and US6 can be worked on in parallel
- All tests within a story marked [P] can run in parallel
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all parallel setup tasks together:
Task: "Create cache types and interfaces in src/cache/types.ts"
Task: "Create artifact reference schema in src/schemas/artifact-ref.ts"
Task: "Add environment variable configuration loader in src/cache/config.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests in parallel:
Task: "Contract test for mermaid_to_svg cached output in tests/behavior/mermaid-to-svg/cached-output.test.ts"
Task: "Contract test for mermaid_to_pdf cached output in tests/behavior/mermaid-to-pdf/cached-output.test.ts"
Task: "Behavior test for artifact file creation in tests/behavior/mermaid-to-svg/cached-output.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (4 tasks)
2. Complete Phase 2: Foundational (8 tasks)
3. Complete Phase 3: User Story 1 (10 tasks)
4. Complete Phase 4: User Story 2 (10 tasks)
5. **STOP and VALIDATE**: Test render-fetch cycle independently
6. Deploy/demo if ready - core functionality complete

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 (session isolation) → Test independently → Security hardened
4. Add User Story 4 (cleanup) → Test independently → Resource managed
5. Add User Story 5 (quota) → Test independently → Production ready
6. Add User Story 6 (fallback) → Test independently → Resilient

### Suggested Implementation Order

1. **Phase 1**: Setup (T001-T004) - 4 tasks
2. **Phase 2**: Foundational (T005-T012) - 8 tasks
3. **Phase 3**: User Story 1 (T013-T022) - 10 tasks - **MVP Part 1**
4. **Phase 4**: User Story 2 (T023-T032) - 10 tasks - **MVP Part 2**
5. **Phase 5**: User Story 3 (T033-T036) - 4 tasks
6. **Phase 6**: User Story 4 (T037-T043) - 7 tasks
7. **Phase 7**: User Story 5 (T044-T050) - 7 tasks
8. **Phase 8**: User Story 6 (T051-T057) - 7 tasks
9. **Phase 9**: Polish (T058-T062) - 5 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group per CLAUDE.md iteration loop
- Stop at any checkpoint to validate story independently
- Follow TDD by Behavior per CLAUDE.md constitution - tests validate observable outcomes
