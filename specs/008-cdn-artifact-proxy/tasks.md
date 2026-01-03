# Tasks: CDN Artifact Proxy

**Input**: Design documents from `/specs/008-cdn-artifact-proxy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cdn-proxy-api.yaml

**Tests**: This project follows TDD by behavior (constitution requirement). Tests are included for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- CDN proxy code in `src/cdn-proxy/`
- Behavior tests in `tests/behavior/cdn-proxy/`
- Kubernetes manifests in `k8s/cdn-proxy/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and CDN proxy directory structure

- [ ] T001 Create CDN proxy directory structure: `src/cdn-proxy/`
- [ ] T002 [P] Add `lru-cache` ^11.x dependency to package.json
- [ ] T003 [P] Create TypeScript interfaces in `src/cdn-proxy/types.ts` per data-model.md
- [ ] T004 [P] Create configuration loader in `src/cdn-proxy/config.ts` per research.md; handle missing S3 credentials gracefully (set s3Configured=false flag)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create HTTP server bootstrap in `src/cdn-proxy/index.ts` (entry point)
- [ ] T006 [P] Create request router with path parsing in `src/cdn-proxy/router.ts`
- [ ] T007 [P] Create structured JSON logger in `src/cdn-proxy/logger.ts` per FR-013
- [ ] T008 [P] Create error response helper in `src/cdn-proxy/errors.ts` per data-model.md ErrorResponse
- [ ] T009 Create request ID middleware (UUID generation) in `src/cdn-proxy/middleware.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Retrieve Artifact via HTTP (Priority: P1)

**Goal**: LAN clients can retrieve SVG/PDF artifacts via simple HTTP GET without S3 credentials

**Independent Test**: Make HTTP GET request to `/artifacts/{artifactId}.svg` and verify SVG content is returned with correct headers

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Behavior test: GET /artifacts/{artifactId}.svg returns 200 with Content-Type image/svg+xml in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`
- [ ] T011 [P] [US1] Behavior test: GET /artifacts/{artifactId}.pdf returns 200 with Content-Type application/pdf in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`
- [ ] T012 [P] [US1] Behavior test: GET /artifacts/{artifactId}.svg for non-existent artifact returns 404 ARTIFACT_NOT_FOUND in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`
- [ ] T013 [P] [US1] Behavior test: GET /artifacts/invalid-path returns 400 INVALID_PATH (invalid artifactId format) in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`
- [ ] T013a [P] [US1] Behavior test: GET artifact when S3 not configured returns 503 NOT_CONFIGURED in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`
- [ ] T013b [P] [US1] Behavior test: GET artifact when S3 returns transient error returns 502 S3_ERROR in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`
- [ ] T014 [P] [US1] Behavior test: Response includes required headers (X-Artifact-Id, X-Request-Id, Cache-Control, Content-Length) in `tests/behavior/cdn-proxy/artifact-retrieval.test.ts`

### Implementation for User Story 1

- [ ] T015 [US1] Create S3 artifact fetcher using existing S3 client patterns in `src/cdn-proxy/s3-fetcher.ts`
- [ ] T016 [US1] Implement path validation (artifactId UUID format, .svg/.pdf extension) in `src/cdn-proxy/router.ts`
- [ ] T017 [US1] Implement artifact GET handler with S3 streaming in `src/cdn-proxy/handlers/artifact.ts`
- [ ] T018 [US1] Add Content-Type mapping (svg→image/svg+xml, pdf→application/pdf) in `src/cdn-proxy/handlers/artifact.ts`
- [ ] T019 [US1] Add response headers (X-Artifact-Id, X-Request-Id, Cache-Control, Content-Length) per FR-004 in `src/cdn-proxy/handlers/artifact.ts`
- [ ] T020 [US1] Implement 404/400/502 error responses per OpenAPI contract in `src/cdn-proxy/handlers/artifact.ts`
- [ ] T021 [US1] Add request logging (path, status, duration_ms) in `src/cdn-proxy/handlers/artifact.ts`

**Checkpoint**: User Story 1 complete - artifacts retrievable via HTTP without credentials

---

## Phase 4: User Story 2 - Health Monitoring (Priority: P2)

**Goal**: Operations teams can monitor service health and S3 connectivity via /health endpoint

**Independent Test**: Call GET /health and verify response contains service status and s3_connected boolean

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T022 [P] [US2] Behavior test: GET /health returns 200 with HealthStatus schema when S3 reachable in `tests/behavior/cdn-proxy/health-check.test.ts`
- [ ] T023 [P] [US2] Behavior test: GET /health returns s3_connected=false when S3 unreachable in `tests/behavior/cdn-proxy/health-check.test.ts`
- [ ] T024 [P] [US2] Behavior test: Health response includes uptime_seconds and timestamp in `tests/behavior/cdn-proxy/health-check.test.ts`

### Implementation for User Story 2

- [ ] T025 [US2] Implement S3 connectivity check (HeadBucket or list prefix) in `src/cdn-proxy/health.ts`
- [ ] T026 [US2] Track service start time for uptime_seconds calculation in `src/cdn-proxy/health.ts`
- [ ] T027 [US2] Implement health handler returning HealthStatus per OpenAPI contract in `src/cdn-proxy/handlers/health.ts`
- [ ] T028 [US2] Register /health route in router in `src/cdn-proxy/router.ts`

**Checkpoint**: User Story 2 complete - health endpoint operational with S3 connectivity status

---

## Phase 5: User Story 3 - In-Memory Caching (Priority: P3)

**Goal**: Frequently accessed artifacts are served from memory, reducing S3 load and improving response times

**Independent Test**: Request same artifact twice; second request is faster and shows X-Cache: HIT header

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T029 [P] [US3] Behavior test: First request returns X-Cache: MISS, second returns X-Cache: HIT in `tests/behavior/cdn-proxy/caching.test.ts`
- [ ] T030 [P] [US3] Behavior test: LRU eviction when cache exceeds max size in `tests/behavior/cdn-proxy/caching.test.ts`
- [ ] T031 [P] [US3] Behavior test: TTL expiration causes cache miss in `tests/behavior/cdn-proxy/caching.test.ts`
- [ ] T032 [P] [US3] Behavior test: Large artifacts (>1MB) bypass cache (X-Cache: BYPASS) in `tests/behavior/cdn-proxy/caching.test.ts`
- [ ] T033 [P] [US3] Behavior test: Concurrent requests for same artifact make only one S3 call in `tests/behavior/cdn-proxy/caching.test.ts`

### Implementation for User Story 3

- [ ] T034 [US3] Create LRU cache wrapper with lru-cache library in `src/cdn-proxy/cache.ts`
- [ ] T035 [US3] Implement size-based eviction (sizeCalculation) in `src/cdn-proxy/cache.ts`
- [ ] T036 [US3] Implement TTL expiration (default 24h) in `src/cdn-proxy/cache.ts`
- [ ] T037 [US3] Implement cache threshold check (skip caching >1MB) in `src/cdn-proxy/cache.ts`
- [ ] T038 [US3] Implement request coalescing (in-flight tracking) per research.md in `src/cdn-proxy/cache.ts`
- [ ] T039 [US3] Add cache statistics tracking (hits, misses, evictions) in `src/cdn-proxy/cache.ts`
- [ ] T040 [US3] Integrate cache layer into artifact handler in `src/cdn-proxy/handlers/artifact.ts`
- [ ] T041 [US3] Add X-Cache header (HIT/MISS/BYPASS) to responses in `src/cdn-proxy/handlers/artifact.ts`
- [ ] T042 [US3] Add cache stats to health endpoint response in `src/cdn-proxy/handlers/health.ts`

**Checkpoint**: User Story 3 complete - caching reduces S3 load for repeated requests

---

## Phase 6: User Story 4 - MCP Tool Response Enhancement (Priority: P4)

**Goal**: MCP render tools include cdn_url field in responses when CDN proxy is configured

**Independent Test**: Call mermaid_to_svg with MERMAID_CDN_BASE_URL set; verify response includes cdn_url field

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T043 [P] [US4] Behavior test: mermaid_to_svg includes cdn_url when MERMAID_CDN_BASE_URL is set in `tests/behavior/tools/mermaid-to-svg.test.ts`
- [ ] T044 [P] [US4] Behavior test: mermaid_to_pdf includes cdn_url when MERMAID_CDN_BASE_URL is set in `tests/behavior/tools/mermaid-to-pdf.test.ts`
- [ ] T045 [P] [US4] Behavior test: cdn_url is omitted when MERMAID_CDN_BASE_URL is not set in `tests/behavior/tools/mermaid-to-svg.test.ts`
- [ ] T046 [P] [US4] Behavior test: cdn_url format matches `/artifacts/{artifactId}.{ext}` pattern in `tests/behavior/tools/mermaid-to-svg.test.ts`

### Implementation for User Story 4

- [ ] T047 [US4] Add MERMAID_CDN_BASE_URL to environment configuration in `src/config.ts` or existing config location
- [ ] T048 [US4] Create cdn_url builder function in `src/tools/cdn-url.ts`
- [ ] T049 [US4] Update mermaid_to_svg response schema to include optional cdn_url in `src/tools/mermaid-to-svg.ts`
- [ ] T050 [US4] Update mermaid_to_pdf response schema to include optional cdn_url in `src/tools/mermaid-to-pdf.ts`
- [ ] T051 [US4] Conditionally include cdn_url in mermaid_to_svg response when configured in `src/tools/mermaid-to-svg.ts`
- [ ] T052 [US4] Conditionally include cdn_url in mermaid_to_pdf response when configured in `src/tools/mermaid-to-pdf.ts`

**Checkpoint**: User Story 4 complete - MCP tools return cdn_url when CDN proxy is configured

---

## Phase 7: Kubernetes Deployment

**Purpose**: Production deployment to k3s cluster

- [ ] T053 [P] Create Secret manifest example in `k8s/cdn-proxy/mermaid-s3-credentials.yaml.example`
- [ ] T054 [P] Create Deployment manifest in `k8s/cdn-proxy/deployment.yaml` with envFrom secretRef
- [ ] T055 [P] Create Service manifest (LoadBalancer, port 8101) in `k8s/cdn-proxy/service.yaml`
- [ ] T056 Create kustomization.yaml including all resources in `k8s/cdn-proxy/kustomization.yaml`
- [ ] T057 Add liveness probe (httpGet /health) to deployment in `k8s/cdn-proxy/deployment.yaml`
- [ ] T058 Add readiness probe (httpGet /health) to deployment in `k8s/cdn-proxy/deployment.yaml`
- [ ] T059 Configure resource limits (256Mi memory for cache) in `k8s/cdn-proxy/deployment.yaml`

---

## Phase 8: Docker & CI Integration

**Purpose**: Build and CI pipeline updates

- [ ] T060 Update Dockerfile to support CDN proxy entrypoint mode in `Dockerfile`
- [ ] T061 [P] Add CDN proxy integration test to `scripts/integration-test.sh` or new script
- [ ] T061a [P] Add concurrency stress test (100 parallel requests) to `tests/behavior/cdn-proxy/concurrency.test.ts` validating SC-004
- [ ] T062 Verify `npm run quality` passes with all new code
- [ ] T063 Run quickstart.md validation (local development steps)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and documentation

- [ ] T064 [P] Update README.md with CDN proxy documentation
- [ ] T065 [P] Update CLAUDE.md with CDN proxy active technologies
- [ ] T066 Add CDN proxy startup logging with configuration summary
- [ ] T067 Verify all TypeScript strict mode compliance (no any types in implementation)
- [ ] T068 Run full Clean Slate Protocol before final commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - Core artifact retrieval
- **User Story 2 (Phase 4)**: Depends on Foundational - Can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 completion (enhances artifact handler)
- **User Story 4 (Phase 6)**: Independent of CDN proxy - modifies MCP tools only
- **K8s Deployment (Phase 7)**: Depends on US1, US2, US3 completion
- **Docker & CI (Phase 8)**: Depends on all user stories
- **Polish (Phase 9)**: Depends on all previous phases

### User Story Dependencies

```
           ┌──────────────────────┐
           │  Phase 1: Setup      │
           └──────────┬───────────┘
                      │
           ┌──────────▼───────────┐
           │  Phase 2: Foundation │
           └──────────┬───────────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
┌──────▼───────┐ ┌────▼────┐   ┌─────▼─────┐
│ US1: Artifact│ │ US2:    │   │ US4: MCP  │
│ Retrieval    │ │ Health  │   │ Integration│
│ (P1)         │ │ (P2)    │   │ (P4)      │
└──────┬───────┘ └────┬────┘   └───────────┘
       │              │
       └──────┬───────┘
              │
       ┌──────▼───────┐
       │ US3: Caching │
       │ (P3)         │
       └──────┬───────┘
              │
       ┌──────▼───────┐
       │ Phase 7: K8s │
       └──────┬───────┘
              │
       ┌──────▼───────┐
       │ Phase 8: CI  │
       └──────┬───────┘
              │
       ┌──────▼───────┐
       │ Phase 9:     │
       │ Polish       │
       └──────────────┘
```

### Parallel Opportunities

**Within Phase 1 (Setup)**:
- T002, T003, T004 can run in parallel (different files)

**Within Phase 2 (Foundation)**:
- T006, T007, T008 can run in parallel (different files)

**User Story Tests (all [P] marked)**:
- All tests for a user story can be written in parallel

**User Stories 1, 2, 4**:
- US1 and US2 can start in parallel after Foundation
- US4 can start any time after Foundation (independent)

**Phase 7 (K8s)**:
- T053, T054, T055 can run in parallel (different files)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for US1 together:
Task: T010 - Behavior test: GET valid SVG artifact returns 200
Task: T011 - Behavior test: GET valid PDF artifact returns 200
Task: T012 - Behavior test: GET non-existent artifact returns 404
Task: T013 - Behavior test: GET invalid path returns 400
Task: T014 - Behavior test: Response includes required headers
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Artifact Retrieval)
4. **STOP and VALIDATE**: Test US1 independently via curl
5. Deploy/demo if ready - basic HTTP artifact proxy works

### Incremental Delivery

1. Complete Setup + Foundational = Foundation ready
2. Add User Story 1 = Test independently = MVP (artifacts via HTTP)
3. Add User Story 2 = Health monitoring for operations
4. Add User Story 3 = Caching for performance
5. Add User Story 4 = MCP integration for seamless UX
6. K8s + CI = Production ready
7. Polish = Documentation complete

### PR Structure (per constitution)

- **PR 1**: Setup + Foundational (Phase 1-2)
- **PR 2**: User Story 1 - Artifact Retrieval (Phase 3)
- **PR 3**: User Story 2 - Health Monitoring (Phase 4)
- **PR 4**: User Story 3 - Caching (Phase 5)
- **PR 5**: User Story 4 - MCP Integration (Phase 6)
- **PR 6**: K8s Deployment (Phase 7)
- **PR 7**: Docker/CI + Polish (Phase 8-9)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing (TDD)
- Run `npm run quality` before every push (constitution)
- Stop at any checkpoint to validate story independently
