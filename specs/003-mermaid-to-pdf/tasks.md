# Tasks: Mermaid to PDF Tool

**Input**: Design documents from `/specs/003-mermaid-to-pdf/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/mermaid-to-pdf.json

**Tests**: Tests ARE INCLUDED per project constitution (TDD by Behavior - Principle II). Tests define behavior first, implementation follows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema and tool structure initialization

- [X] T001 Create PDF schema file in src/schemas/mermaid-to-pdf.ts with input/output types extending SVG patterns
- [X] T002 Create PDF tool skeleton in src/tools/mermaid-to-pdf.ts with ToolConfig structure
- [X] T003 Register mermaid_to_pdf tool in src/tools/index.ts

> **Note on FR-010 (Request ID)**: Request ID generation is inherited from the existing SVG renderer pipeline. No dedicated task required as T017 (wire complete pipeline) reuses this infrastructure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create test directory structure at tests/behavior/mermaid-to-pdf/
- [X] T005 Implement PDF_GENERATION_FAILED error code in schema (extends existing ErrorCodeSchema)
- [X] T006 Implement timeout budget splitting utility (80% SVG / 20% PDF per research.md)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Generate PDF from Mermaid Diagram (Priority: P1) 🎯 MVP

**Goal**: A developer can generate a PDF document from valid Mermaid diagram source code, receiving vector-quality output.

**Independent Test**: Provide valid Mermaid diagram code, verify valid PDF is returned with vector graphics preserved.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (Constitution Principle II)**

- [X] T007 [P] [US1] Contract test for input validation in tests/behavior/mermaid-to-pdf/contract.test.ts
- [X] T008 [P] [US1] Contract test for success output structure in tests/behavior/mermaid-to-pdf/contract.test.ts
- [X] T009 [P] [US1] PDF validation test (magic bytes, vector operators) in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts
- [X] T010 [P] [US1] Integration test for flowchart to PDF in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts
- [X] T011 [P] [US1] Integration test for sequence diagram to PDF in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts
- [X] T012 [P] [US1] Theme support test (dark/forest/neutral) in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts

### Implementation for User Story 1

- [X] T013 [US1] Implement SVG dimension extraction utility in src/tools/mermaid-to-pdf.ts
- [X] T014 [US1] Implement HTML wrapper for inline SVG embedding in src/tools/mermaid-to-pdf.ts
- [X] T015 [US1] Implement page.pdf() call with dimension matching in src/tools/mermaid-to-pdf.ts
- [X] T016 [US1] Implement base64 encoding for PDF output in src/tools/mermaid-to-pdf.ts
- [X] T017 [US1] Wire complete pipeline: validate → render SVG → embed HTML → generate PDF → encode in src/tools/mermaid-to-pdf.ts
- [X] T018 [US1] Add theme parameter passthrough to SVG renderer in src/tools/mermaid-to-pdf.ts
- [X] T019 [US1] Add background parameter passthrough to SVG renderer in src/tools/mermaid-to-pdf.ts
- [X] T020 [US1] Add config_json parameter passthrough to SVG renderer in src/tools/mermaid-to-pdf.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Handle Invalid Input Gracefully (Priority: P2)

**Goal**: Return clear, actionable error messages for invalid or malformed input to help developers fix problems.

**Independent Test**: Provide various types of invalid input, verify appropriate error codes and messages are returned.

### Tests for User Story 2

- [X] T021 [P] [US2] Error test for empty code input in tests/behavior/mermaid-to-pdf/error-handling.test.ts
- [X] T022 [P] [US2] Error test for whitespace-only code in tests/behavior/mermaid-to-pdf/error-handling.test.ts
- [X] T023 [P] [US2] Error test for oversized input (>1MB) in tests/behavior/mermaid-to-pdf/error-handling.test.ts
- [X] T024 [P] [US2] Error test for invalid Mermaid syntax in tests/behavior/mermaid-to-pdf/error-handling.test.ts
- [X] T025 [P] [US2] Error test for malformed config_json in tests/behavior/mermaid-to-pdf/error-handling.test.ts
- [X] T026 [P] [US2] Error test for invalid timeout_ms range in tests/behavior/mermaid-to-pdf/error-handling.test.ts

### Implementation for User Story 2

- [X] T027 [US2] Implement input validation (empty/whitespace check) in src/tools/mermaid-to-pdf.ts
- [X] T028 [US2] Implement input size validation (1MB limit) in src/tools/mermaid-to-pdf.ts
- [X] T029 [US2] Implement config_json validation (valid JSON object) in src/tools/mermaid-to-pdf.ts
- [X] T030 [US2] Implement timeout_ms validation (1000-120000 range) in src/tools/mermaid-to-pdf.ts
- [X] T031 [US2] Map SVG renderer errors to appropriate error codes in src/tools/mermaid-to-pdf.ts
- [X] T032 [US2] Implement PDF_GENERATION_FAILED error mapping in src/tools/mermaid-to-pdf.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Timeout Protection (Priority: P3)

**Goal**: Enforce time limits on rendering and clean up resources properly rather than hanging indefinitely.

**Independent Test**: Provide complex diagrams with short timeouts, verify timeout error returned within specified time.

### Tests for User Story 3

- [X] T033 [P] [US3] Timeout test with short timeout value in tests/behavior/mermaid-to-pdf/timeout.test.ts
- [X] T034 [P] [US3] Resource cleanup test after timeout in tests/behavior/mermaid-to-pdf/timeout.test.ts
- [X] T035 [P] [US3] Timeout budget split verification test in tests/behavior/mermaid-to-pdf/timeout.test.ts

### Implementation for User Story 3

- [X] T036 [US3] Implement timeout budget splitting (80% SVG / 20% PDF) in src/tools/mermaid-to-pdf.ts
- [X] T037 [US3] Implement PDF generation timeout wrapper with AbortController in src/tools/mermaid-to-pdf.ts
- [X] T038 [US3] Implement resource cleanup on timeout (page.close, browser cleanup) in src/tools/mermaid-to-pdf.ts
- [X] T039 [US3] Implement RENDER_TIMEOUT error response for PDF phase in src/tools/mermaid-to-pdf.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and integration testing

- [X] T040 [P] Add mermaid_to_pdf to MCP Inspector integration test script in scripts/integration-test.sh
- [X] T041 [P] Validate quickstart.md examples work with implemented tool
- [X] T042 Run full quality gate: npm run quality
- [X] T043 Verify contract.json schema matches implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May share validation code with US1 but is independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May share timeout handling with US1 but is independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle II)
- Schema before implementation
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks can run sequentially (same files, dependencies)
- All Foundational tasks marked [P] can run in parallel
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together (write, verify they fail):
Task: "Contract test for input validation in tests/behavior/mermaid-to-pdf/contract.test.ts"
Task: "Contract test for success output structure in tests/behavior/mermaid-to-pdf/contract.test.ts"
Task: "PDF validation test (magic bytes, vector operators) in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts"
Task: "Integration test for flowchart to PDF in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts"
Task: "Integration test for sequence diagram to PDF in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts"
Task: "Theme support test (dark/forest/neutral) in tests/behavior/mermaid-to-pdf/pdf-validation.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Constitution Principle II)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `npm run quality` before every push (Constitution Principle III)
