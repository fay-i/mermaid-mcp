# Tasks: Mermaid to SVG Conversion Tool

**Input**: Design documents from `/specs/002-mermaid-to-svg/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: This feature is a single MCP tool implementation (one tool = one PR). Tasks are organized by functional area rather than user stories since all functionality ships together.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## PR Structure

Per the plan and constitution, this feature ships as **one PR** containing:
- The `mermaid_to_svg` MCP tool (single tool = single PR)
- All schemas, renderer logic, and behavior tests
- Test fixtures for all 8 diagram types

---

## Phase 1: Dependencies & Schema Foundation

**Objective**: Install dependencies and implement input/output schemas

**Behavioral Test Requirements**:
- Schema validation rejects invalid inputs (empty code, oversized input, invalid theme, out-of-range timeout)
- Schema validation accepts valid inputs (all parameter combinations)
- Output schema validates success and error response structures

### Tasks

- [ ] T001 Install dependencies: `@mermaid-js/mermaid-cli@^11.12.0` and `puppeteer@^23.0.0` in package.json
- [ ] T002 [P] Implement input schema with Zod in src/schemas/mermaid-to-svg.ts (per contracts/mermaid-to-svg-input.json)
- [ ] T003 [P] Implement output schema (success/error discriminated union) in src/schemas/mermaid-to-svg.ts (per contracts/mermaid-to-svg-output.json)
- [ ] T004 [P] Export schemas from src/schemas/index.ts
- [ ] T005 Implement schema validation behavior tests in tests/behavior/mermaid-to-svg/schema-validation.test.ts

**Acceptance Criteria**:
- `npm install` completes without errors
- Schema tests validate: empty code rejected, >1MB rejected, invalid theme rejected, timeout range enforced
- Schema tests validate: success response includes `svg` field, error response MUST NOT include `svg` field (FR-016)
- `npm run quality` passes

---

## Phase 2: Test Fixtures

**Objective**: Create sample Mermaid diagrams for all 8 supported types

**Behavioral Test Requirements**:
- Each fixture is syntactically valid Mermaid code
- One invalid fixture exists for parse error testing

### Tasks

- [ ] T006 [P] Create flowchart fixture in tests/fixtures/mermaid/flowchart.mmd
- [ ] T007 [P] Create sequence diagram fixture in tests/fixtures/mermaid/sequence.mmd
- [ ] T008 [P] Create class diagram fixture in tests/fixtures/mermaid/class.mmd
- [ ] T009 [P] Create state diagram fixture in tests/fixtures/mermaid/state.mmd
- [ ] T010 [P] Create ER diagram fixture in tests/fixtures/mermaid/er.mmd
- [ ] T011 [P] Create gantt chart fixture in tests/fixtures/mermaid/gantt.mmd
- [ ] T012 [P] Create pie chart fixture in tests/fixtures/mermaid/pie.mmd
- [ ] T013 [P] Create journey diagram fixture in tests/fixtures/mermaid/journey.mmd
- [ ] T014 [P] Create invalid syntax fixture in tests/fixtures/mermaid/invalid-syntax.mmd

**Acceptance Criteria**:
- 9 fixture files exist under tests/fixtures/mermaid/
- Each valid fixture represents its diagram type correctly
- Invalid fixture triggers PARSE_ERROR when rendered

---

## Phase 3: Renderer Module

**Objective**: Implement Mermaid rendering with Puppeteer, deterministic output, and resource cleanup

**Behavioral Test Requirements**:
- Same input produces identical SVG output (determinism test)
- Browser resources are cleaned up after render (no leaks)
- Parse errors are caught and mapped to PARSE_ERROR
- Timeout is enforced (within 500ms accuracy)

### Tasks

- [ ] T015 Define renderer types in src/renderer/types.ts (RenderOptions, RenderResult interfaces)
- [ ] T016 [P] Implement browser lifecycle management in src/renderer/browser.ts (launch with headless:'shell', close in finally)
- [ ] T017 Implement determinism behavior test in tests/behavior/renderer/determinism.test.ts (same input = identical SVG)
- [ ] T018 Implement render facade in src/renderer/index.ts using renderMermaid from @mermaid-js/mermaid-cli
- [ ] T019 Configure deterministic output: deterministicIds=true, deterministicIDSeed='mermaid-mcp', seed=42
- [ ] T020 Export renderer from src/renderer/index.ts

**Acceptance Criteria**:
- Renderer produces valid SVG from flowchart fixture
- Same input rendered twice produces byte-identical SVG
- Browser is closed after each render (verify in test cleanup)
- `npm run quality` passes

---

## Phase 4: Error Handling

**Objective**: Implement error code mapping and input validation

**Behavioral Test Requirements**:
- INVALID_INPUT for empty/missing code
- INPUT_TOO_LARGE for >1MB input
- PARSE_ERROR for syntax errors (with message extraction)
- INVALID_CONFIG for malformed config_json
- INVALID_TIMEOUT for out-of-range timeout
- RENDER_TIMEOUT for exceeded timeout
- RENDER_FAILED for renderer crashes

### Tasks

- [ ] T021 [P] Implement error handling behavior tests in tests/behavior/mermaid-to-svg/error-handling.test.ts
- [ ] T022 Implement input validation in src/tools/mermaid-to-svg.ts (code presence, size limit)
- [ ] T023 Implement config_json parsing and validation
- [ ] T024 Implement timeout validation (1000-120000ms range)
- [ ] T025 [P] Implement timeout behavior tests in tests/behavior/mermaid-to-svg/timeout.test.ts
- [ ] T026 Implement timeout enforcement with AbortController or Promise.race
- [ ] T027 Implement error code mapping from Mermaid/Puppeteer exceptions
- [ ] T027.1 [P] Implement edge case behavior tests in tests/behavior/mermaid-to-svg/edge-cases.test.ts covering: valid syntax producing empty diagram, Unicode characters in labels, invalid theme value, invalid background color format

**Acceptance Criteria**:
- Empty code returns INVALID_INPUT
- 2MB input returns INPUT_TOO_LARGE
- Invalid Mermaid syntax returns PARSE_ERROR with descriptive message
- timeout_ms=500 returns INVALID_TIMEOUT
- timeout_ms=200000 returns INVALID_TIMEOUT
- Edge cases: empty diagram renders, Unicode labels work, invalid theme/background rejected
- All error tests pass in `npm run quality`

---

## Phase 5: MCP Tool Implementation

**Objective**: Wire up the mermaid_to_svg tool with MCP SDK

**Behavioral Test Requirements**:
- Tool is discoverable via tools/list
- Valid input returns ok:true with SVG
- All optional parameters work (theme, background, config_json, timeout_ms)
- Response includes unique request_id (UUID)

### Tasks

- [ ] T028 [P] Implement valid input behavior tests in tests/behavior/mermaid-to-svg/valid-input.test.ts
- [ ] T029 Implement mermaid_to_svg tool handler in src/tools/mermaid-to-svg.ts
- [ ] T030 Register tool with input schema in src/tools/index.ts
- [ ] T031 Implement request_id generation (UUID v4) per request
- [ ] T032 Implement theme parameter support (default, dark, forest, neutral) — verify "default" maps to Mermaid's actual default theme or omit theme config for default behavior
- [ ] T033 Implement background parameter support (transparent, CSS colors)

**Acceptance Criteria**:
- `npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list` shows mermaid_to_svg
- Tool renders flowchart fixture to valid SVG (parses as XML, has `<svg>` root with correct namespace)
- Theme parameter applies correct styling
- Background parameter applies correct color
- Response structure matches output schema

---

## Phase 6: Resource Cleanup & Integration Tests

**Objective**: Ensure resource cleanup and end-to-end MCP integration

**Behavioral Test Requirements**:
- Resources cleaned up on success
- Resources cleaned up on error
- Resources cleaned up on timeout
- Integration tests pass via MCP Inspector CLI

### Tasks

- [ ] T034 [P] Implement cleanup and isolation behavior tests in tests/behavior/mermaid-to-svg/cleanup.test.ts (resources cleaned up on success/error/timeout)
- [ ] T034.1 Implement concurrent isolation test: two simultaneous renders with different inputs produce correct independent outputs (FR-015)
- [ ] T035 Verify browser cleanup in finally block for all code paths
- [ ] T036 Add MCP integration tests to scripts/integration-test.sh for mermaid_to_svg tool
- [ ] T037 Test all 8 diagram types render successfully via integration tests

**Acceptance Criteria**:
- Cleanup tests verify browser is closed after success/error/timeout
- Concurrent isolation test verifies independent outputs (FR-015)
- Integration tests pass: `npm run test:integration`
- All 8 diagram types produce valid SVG
- `npm run quality` passes (all unit + integration tests)

---

## Phase 7: Quality Validation

**Objective**: Full quality gate pass and PR readiness

**Behavioral Test Requirements**:
- All behavior tests pass
- All integration tests pass
- TypeScript compiles with no errors
- Biome lint/format passes
- Build produces valid dist/

### Tasks

- [ ] T038 Run clean slate validation: `npm run clean && rm -rf node_modules && npm install && npm run quality`
- [ ] T039 Verify SC-001: Simple flowchart renders in <5s
- [ ] T040 Verify SC-003: Deterministic output (identical inputs produce identical SVG) [confirms T017 at integration level]
- [ ] T041 Verify FR-012: Resource cleanup after every request

**Acceptance Criteria**:
- `npm run quality` passes with zero warnings/errors
- All success criteria measurable and verified
- Ready for PR creation

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Schemas) ──────┐
                        ├──► Phase 3 (Renderer) ──► Phase 4 (Errors) ──► Phase 5 (Tool) ──► Phase 6 (Integration) ──► Phase 7 (Quality)
Phase 2 (Fixtures) ─────┘
```

### Task Dependencies

- T001 must complete before T015-T020 (renderer needs mermaid-cli)
- T002-T004 can run in parallel (schemas are independent)
- T006-T014 can run in parallel (fixtures are independent files)
- T015-T016 must complete before T018 (renderer needs types and browser)
- T017 depends on T018 (determinism test needs renderer)
- T021-T027 can start after Phase 3 (error handling builds on renderer)
- T028-T033 can start after Phase 4 (tool wires up renderer + error handling)
- T034-T037 depend on Phase 5 (integration tests need working tool)
- T038-T041 depend on all previous phases

### Parallel Opportunities

**Phase 1**: T002, T003, T004 (different schema files)
**Phase 2**: T006-T014 (all fixtures in parallel - 9 independent files)
**Phase 4**: T021, T025 (error and timeout tests in parallel)
**Phase 5**: T028 (valid input tests can start while T029-T033 in progress)
**Phase 6**: T034 (cleanup tests can parallel with T036-T037 integration tests)

---

## Implementation Strategy

### TDD Cycle Per Task

1. Write failing behavior test
2. Implement minimal code to pass
3. Run `npm run quality`
4. Commit
5. Push and await Claude Code review
6. Address critical/major feedback
7. Repeat until clean

### 10-Minute Iteration Loop

Each task should complete within one 10-minute cycle:
1. Test/implement (5 min)
2. Local quality gate (2 min)
3. Review feedback (2 min)
4. Address feedback (1 min)

### PR Acceptance Criteria

- [ ] All 43 tasks completed
- [ ] `npm run quality` passes (typecheck + lint + format + build + test + test:integration)
- [ ] Clean slate validation passes (T038)
- [ ] Success criteria SC-001, SC-003, FR-012 verified
- [ ] No skipped tests, no eslint-disable, no ts-ignore
- [ ] PR created via GitHub MCP with complete description

---

## Summary

| Metric | Count |
|--------|-------|
| Total Tasks | 43 |
| Phase 1 (Schemas) | 5 |
| Phase 2 (Fixtures) | 9 |
| Phase 3 (Renderer) | 6 |
| Phase 4 (Errors) | 8 |
| Phase 5 (Tool) | 6 |
| Phase 6 (Integration) | 5 |
| Phase 7 (Quality) | 4 |
| Parallel Opportunities | 25 tasks marked [P] |
| Estimated Iterations | 16-21 (grouping parallel tasks) |

**MVP Scope**: Phases 1-5 deliver a working tool. Phase 6-7 ensure quality and integration.
