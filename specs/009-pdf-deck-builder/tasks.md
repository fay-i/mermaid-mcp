# Tasks: PDF Deck Builder

**Input**: Design documents from `/specs/009-pdf-deck-builder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mermaid-to-deck.json

**Tests**: Tests are included per project constitution (TDD by Behavior - tests first, always).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency updates, and schema foundation

- [X] T001 Move pdf-lib from devDependencies to dependencies in package.json
- [X] T002 [P] Create src/schemas/mermaid-to-deck.ts with Zod schemas for DiagramInput, Margins, DeckRequest
- [X] T003 [P] Create src/schemas/deck-response.ts with Zod schemas for PageMetadata, S3Location, DeckSuccessResponse, DeckErrorResponse
- [X] T004 Add deck-specific error codes to src/schemas/error-codes.ts (PDF_GENERATION_FAILED, INVALID_TIMEOUT)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T005 Create src/renderer/deck-assembler.ts with pdf-lib assembly function signature (stub)
- [X] T006 Create src/tools/deck-renderer.ts with multi-diagram rendering function signature (stub)
- [X] T007 Create src/tools/mermaid-to-deck.ts tool file with tool registration skeleton

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Generate Multi-Diagram PDF Deck (Priority: P1)

**Goal**: Users can submit multiple Mermaid diagrams and receive a single PDF with each diagram on its own page

**Independent Test**: Call the tool with 2+ valid Mermaid diagrams and verify output is a downloadable multi-page PDF with correct page count

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Behavior test for input validation (empty array, missing code) in tests/behavior/mermaid-to-deck/input-validation.test.ts
- [X] T009 [P] [US1] Behavior test for successful 3-diagram deck generation in tests/behavior/mermaid-to-deck/deck-generation.test.ts
- [X] T010 [P] [US1] Behavior test for page count matching diagram count in tests/behavior/mermaid-to-deck/deck-generation.test.ts
- [X] T011 [P] [US1] Behavior test for HTML template generation in tests/behavior/mermaid-to-deck/deck-assembler.test.ts
- [X] T012 [P] [US1] Behavior test for PDF page assembly in tests/behavior/mermaid-to-deck/deck-assembler.test.ts

### Implementation for User Story 1

- [X] T013 [US1] Implement input validation in src/tools/mermaid-to-deck.ts (diagrams array 1-100 items)
- [X] T014 [US1] Implement size validation in src/tools/mermaid-to-deck.ts (10MB total, 1MB per diagram)
- [X] T015 [US1] Implement browser lifecycle management in src/tools/deck-renderer.ts (launch once, reuse page)
- [X] T016 [US1] Implement createPageHtml() template function in src/renderer/deck-assembler.ts
- [X] T017 [US1] Implement SVG rendering loop in src/tools/deck-renderer.ts (iterate diagrams, call render())
- [X] T018 [US1] Implement PDF page assembly with pdf-lib in src/renderer/deck-assembler.ts
- [X] T019 [US1] Implement S3 storage integration in src/tools/mermaid-to-deck.ts (reuse S3Storage.storeArtifact)
- [X] T020 [US1] Implement success response builder in src/tools/mermaid-to-deck.ts (download_url, page_count, pages)
- [X] T021 [US1] Register mermaid_to_deck tool in src/tools/index.ts

**Checkpoint**: User Story 1 complete - basic deck generation works with default options

---

## Phase 4: User Story 2 - Configure Page Layout and Formatting (Priority: P2)

**Goal**: Users can specify page size, orientation, margins, and titles to customize output

**Independent Test**: Generate same diagrams with different layout options and verify PDF reflects those choices

### Tests for User Story 2

- [ ] T022 [P] [US2] Behavior test for page size options (letter, a4, legal) in tests/behavior/mermaid-to-deck.test.ts
- [ ] T023 [P] [US2] Behavior test for orientation options (landscape, portrait) in tests/behavior/mermaid-to-deck.test.ts
- [ ] T024 [P] [US2] Behavior test for title display (show_titles: true/false) in tests/behavior/mermaid-to-deck.test.ts
- [ ] T025 [P] [US2] Behavior test for margin configuration in tests/behavior/deck-assembler.test.ts

### Implementation for User Story 2

- [ ] T026 [US2] Implement page size calculations in src/renderer/deck-assembler.ts (letter: 792x612, a4: 842x595, legal: 1008x612 landscape)
- [ ] T027 [US2] Implement orientation switching in src/renderer/deck-assembler.ts (swap width/height for portrait)
- [ ] T028 [US2] Implement title rendering in createPageHtml() in src/renderer/deck-assembler.ts
- [ ] T029 [US2] Implement margin configuration in createPageHtml() in src/renderer/deck-assembler.ts
- [ ] T030 [US2] Implement theme passthrough to render() in src/tools/deck-renderer.ts
- [ ] T031 [US2] Implement background color configuration in src/renderer/deck-assembler.ts
- [ ] T032 [US2] Implement drop_shadow and google_font passthrough in src/tools/deck-renderer.ts (default: "Source Code Pro")

**Checkpoint**: User Story 2 complete - all layout options functional

---

## Phase 5: User Story 3 - Handle Errors Gracefully (Priority: P2)

**Goal**: Clear, actionable error information when diagrams fail or limits exceeded

**Independent Test**: Submit intentionally invalid diagrams and verify errors contain specific diagram indices and details

### Tests for User Story 3

- [ ] T033 [P] [US3] Behavior test for PARSE_ERROR with diagram_index in tests/behavior/mermaid-to-deck.test.ts
- [ ] T034 [P] [US3] Behavior test for INPUT_TOO_LARGE (>100 diagrams) in tests/behavior/mermaid-to-deck.test.ts
- [ ] T035 [P] [US3] Behavior test for INPUT_TOO_LARGE (>10MB total) in tests/behavior/mermaid-to-deck.test.ts
- [ ] T036 [P] [US3] Behavior test for RENDER_TIMEOUT in tests/behavior/mermaid-to-deck.test.ts
- [ ] T037 [P] [US3] Behavior test for PDF_GENERATION_FAILED in tests/behavior/deck-assembler.test.ts
- [ ] T038 [P] [US3] Behavior test for browser cleanup on failure in tests/behavior/deck-renderer.test.ts

### Implementation for User Story 3

- [ ] T039 [US3] Implement strict fail-fast error handling in src/tools/deck-renderer.ts (any failure stops operation)
- [ ] T040 [US3] Implement error mapping (parse errors -> PARSE_ERROR with diagram_index) in src/tools/deck-renderer.ts
- [ ] T041 [US3] Implement timeout budget tracking in src/tools/deck-renderer.ts (global timeout, remaining per diagram)
- [ ] T042 [US3] Implement RENDER_TIMEOUT error path in src/tools/deck-renderer.ts
- [ ] T043 [US3] Implement PDF_GENERATION_FAILED error path in src/renderer/deck-assembler.ts
- [ ] T044 [US3] Implement STORAGE_FAILED error path in src/tools/mermaid-to-deck.ts
- [ ] T045 [US3] Implement browser cleanup in finally block in src/tools/deck-renderer.ts

**Checkpoint**: User Story 3 complete - all error paths return actionable information

---

## Phase 6: User Story 4 - Access Generated Deck via Multiple URLs (Priority: P3)

**Goal**: Users receive presigned S3 URL and CDN URL for downloading generated PDFs

**Independent Test**: Generate a deck and verify both URLs are present and resolve to the same PDF

### Tests for User Story 4

- [ ] T046 [P] [US4] Behavior test for presigned download_url in response in tests/behavior/mermaid-to-deck.test.ts
- [ ] T047 [P] [US4] Behavior test for cdn_url when CDN configured in tests/behavior/mermaid-to-deck.test.ts
- [ ] T048 [P] [US4] Behavior test for curl_command format in tests/behavior/mermaid-to-deck.test.ts

### Implementation for User Story 4

- [ ] T049 [US4] Implement CDN URL generation in src/tools/mermaid-to-deck.ts (check MERMAID_CDN_BASE_URL env)
- [ ] T050 [US4] Implement curl_command generation in src/tools/mermaid-to-deck.ts
- [ ] T051 [US4] Implement expires_in_seconds in response (1 hour, matching session cache) in src/tools/mermaid-to-deck.ts

**Checkpoint**: User Story 4 complete - all URL access patterns work

---

## Phase 7: Response Enrichment (Cross-Cutting)

**Purpose**: Add diagram type detection and metadata collection

### Tests

- [ ] T052 [P] Behavior test for diagram type detection (flowchart, sequence, class, etc.) in tests/behavior/deck-assembler.test.ts
- [ ] T053 [P] Behavior test for PageMetadata structure in response in tests/behavior/mermaid-to-deck.test.ts

### Implementation

- [ ] T054 Implement detectDiagramType() regex matcher in src/renderer/deck-assembler.ts
- [ ] T055 Implement PageMetadata collection in src/tools/deck-renderer.ts (index, title, diagram_type)
- [ ] T056 Add pages array to success response in src/tools/mermaid-to-deck.ts

---

## Phase 7b: Observability (Cross-Cutting)

**Purpose**: Add structured logging with correlation IDs for request tracing (FR-021)

### Tests

- [ ] T057 [P] Behavior test for correlation ID presence in logs in tests/behavior/mermaid-to-deck.test.ts
- [ ] T058 [P] Behavior test for structured log format (JSON with timestamp, level, correlationId, message) in tests/behavior/mermaid-to-deck.test.ts

### Implementation

- [ ] T059 Implement generateCorrelationId() in src/tools/mermaid-to-deck.ts (UUID v4)
- [ ] T060 Implement structuredLog() helper in src/tools/mermaid-to-deck.ts (console.log JSON format)
- [ ] T061 Add correlation ID to all log points in deck generation flow (start, per-diagram, completion, error)

---

## Phase 8: Integration & Polish

**Purpose**: End-to-end testing, documentation, and final verification

- [ ] T062 Integration test for tool discovery via MCP Inspector CLI in tests/integration/deck.test.ts
- [ ] T063 Integration test for end-to-end deck generation in tests/integration/deck.test.ts
- [ ] T064 [P] Add test fixtures for multi-diagram scenarios in tests/fixtures/diagrams/
- [ ] T065 [P] Update README.md with mermaid_to_deck tool documentation
- [ ] T066 [P] Update CLAUDE.md with new tool info
- [ ] T067 Run quickstart.md validation (manual testing)
- [ ] T068 Performance test: verify 10-page deck completes in <60s (SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - Core functionality
- **User Story 2 (Phase 4)**: Depends on Foundational - Can run parallel to US1 after foundation
- **User Story 3 (Phase 5)**: Depends on Foundational - Can run parallel to US1/US2 after foundation
- **User Story 4 (Phase 6)**: Depends on Foundational - Can run parallel to US1/US2/US3 after foundation
- **Response Enrichment (Phase 7)**: Depends on US1 completion (needs basic rendering loop)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: INDEPENDENT - Core deck generation
- **User Story 2 (P2)**: INDEPENDENT - Layout configuration (extends HTML template)
- **User Story 3 (P2)**: INDEPENDENT - Error handling (wraps rendering)
- **User Story 4 (P3)**: INDEPENDENT - URL generation (extends response)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schema work before implementation
- Core logic before integrations
- Error paths after happy paths

### Parallel Opportunities

**Setup Phase (T001-T004)**:
```
T001 (sequential - package.json)
T002, T003 can run in parallel (different schema files)
T004 (sequential - extends existing file)
```

**User Story 1 Tests (T008-T012)**:
```
All tests can run in parallel - different test files
```

**User Story 2 (after Foundational)**:
```
T022, T023, T024, T025 - all tests in parallel
Then implementation in dependency order
```

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (write first, verify fail):
Task: T008 "Behavior test for input validation in tests/behavior/mermaid-to-deck.test.ts"
Task: T009 "Behavior test for successful 3-diagram deck generation"
Task: T010 "Behavior test for page count matching diagram count"
Task: T011 "Behavior test for HTML template generation"
Task: T012 "Behavior test for PDF page assembly"

# After tests fail, implement in sequence:
Task: T013 "Implement input validation" (no deps)
Task: T014 "Implement size validation" (no deps)
Task: T015 "Implement browser lifecycle" (no deps)
Task: T016 "Implement createPageHtml()" (no deps)
Task: T017 "Implement SVG rendering loop" (depends on T015, T016)
Task: T018 "Implement PDF assembly" (depends on T17)
Task: T019 "Implement S3 storage" (depends on T18)
Task: T020 "Implement response builder" (depends on T19)
Task: T021 "Register tool" (depends on T20)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (tests first, then implementation)
4. **STOP and VALIDATE**: Test deck generation independently
5. Deploy/demo if ready - basic deck generation works!

### Incremental Delivery

1. Setup + Foundational + US1 -> MVP: Basic deck generation
2. Add US2 -> Layout customization
3. Add US3 -> Error handling improvements
4. Add US4 -> CDN URL support
5. Add Phase 7 -> Diagram type metadata
6. Polish -> Documentation, performance verification

### PR Strategy (per CLAUDE.md)

- **PR 1**: Setup + Foundational + User Story 1 (MVP)
- **PR 2**: User Story 2 (Layout Configuration)
- **PR 3**: User Story 3 (Error Handling)
- **PR 4**: User Story 4 (URL Access)
- **PR 5**: Response Enrichment + Polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Tests follow project TDD constitution - write and fail before implementation
- Run `npm run quality` before every push (clean slate protocol)
- No bypasses per CLAUDE.md - all tests must pass
