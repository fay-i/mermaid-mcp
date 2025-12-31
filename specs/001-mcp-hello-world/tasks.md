# Tasks: MCP Server Foundation - Hello World

**Input**: Design documents from `/specs/001-mcp-hello-world/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are organized by PR scope per governance requirements (one foundational PR, one PR per MCP tool).

## Format: `[ID] [P?] [PR?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[PR]**: Which PR this task belongs to (PR1 = Foundation, PR2 = Healthcheck Tool)
- Include exact file paths in descriptions

---

## PR 1: Foundation (Repository + Tooling + CI)

**Objective**: Set up repository structure, tooling (TypeScript, Vitest, Biome), CI pipeline, and MCP server skeleton

**Behavioral Test Requirements**:
- Server starts and accepts stdio connection
- Server responds to MCP protocol handshake
- Quality gate (`npm run quality`) passes with zero errors

**Acceptance Criteria**:
- `npm install` completes without errors
- `npm run quality` passes (tests + typecheck + lint + format + build)
- `npm run build` produces `dist/index.js`
- Server skeleton starts without crashing
- CI workflow runs on PRs and passes

**Local/CI Checks**: `npm run quality` must pass before merge

**Review Requirements**: Claude Code review; critical/major feedback addressed; 10-minute iteration cycles

### Phase 1: Setup (Project Initialization)

- [ ] T001 [PR1] Create package.json with npm init and add dependencies per research.md (`@modelcontextprotocol/sdk`, `zod`, `@biomejs/biome`, `typescript`, `vitest`, `@types/node`)
- [ ] T002 [PR1] Create tsconfig.json with TypeScript 5.x config (ES2022 target, ESNext modules, strict mode) per research.md
- [ ] T003 [P] [PR1] Create biome.json with Biome configuration for linting and formatting
- [ ] T004 [P] [PR1] Create vitest.config.ts with Vitest configuration for behavior tests
- [ ] T005 [PR1] Add npm scripts to package.json: `test`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `build`, `clean`, `quality`

### Phase 2: Foundational (Core Infrastructure)

**Purpose**: MCP server skeleton and CI pipeline that MUST be complete before healthcheck tool implementation

- [ ] T006 [PR1] Create src/version.ts to export VERSION from package.json
- [ ] T007 [PR1] Create src/tools/types.ts with ToolConfig interface per research.md pattern
- [ ] T008 [PR1] Create src/tools/index.ts as tool registry (empty array initially)
- [ ] T009 [PR1] Create src/schemas/index.ts as schema exports (empty initially)
- [ ] T010 [PR1] Create src/index.ts with MCP server entry point using stdio transport (no tools registered yet)
- [ ] T011 [P] [PR1] Create .github/workflows/ci.yml with GitHub Actions (run on PRs and pushes to main, < 10 minutes, same gates as local)
- [ ] T012 [PR1] Create tests/behavior/server.test.ts with server startup behavior tests (server starts, accepts connection)

**Checkpoint**: Foundation ready - `npm run quality` passes, CI workflow validates, server skeleton runs

---

## PR 2: Healthcheck Tool

**Objective**: Implement healthcheck MCP tool with full behavior tests per User Stories 1 and 2

**Behavioral Test Requirements** (Tests-First TDD):
- Tool returns `ok: true`, `status: "healthy"`, valid `version`, valid ISO `timestamp`
- Tool echoes input value exactly when `echo` parameter provided
- Tool omits `echo` field when no input provided
- Response time < 100ms (SC-002)
- Empty string echo handled correctly
- Special characters in echo preserved exactly

**Acceptance Criteria**:
- Healthcheck tool discoverable by MCP clients
- All acceptance scenarios from spec.md pass
- `npm run quality` passes with zero errors
- Tool contract matches JSON schemas in contracts/

**Local/CI Checks**: `npm run quality` must pass before merge

**Review Requirements**: Claude Code review; critical/major feedback addressed; 10-minute iteration cycles

### Tests for Healthcheck (TDD - Write First, Must Fail)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [PR2] Create tests/behavior/healthcheck.test.ts - test: returns ok=true, status="healthy" when invoked with no params
- [ ] T014 [P] [PR2] Add test: returns valid semver version string in response
- [ ] T015 [P] [PR2] Add test: returns valid ISO 8601 timestamp in response
- [ ] T016 [P] [PR2] Add test: echoes exact value when echo parameter provided
- [ ] T017 [P] [PR2] Add test: omits echo field when no echo parameter provided
- [ ] T018 [P] [PR2] Add test: handles empty string echo correctly
- [ ] T019 [P] [PR2] Add test: preserves special characters in echo value
- [ ] T020 [P] [PR2] Add test: responds within 100ms (per SC-002)

### Implementation for Healthcheck

- [ ] T021 [PR2] Create src/schemas/healthcheck.ts with Zod schemas (HealthcheckInputSchema, HealthcheckOutputSchema) matching contracts/
- [ ] T022 [PR2] Update src/schemas/index.ts to export healthcheck schemas
- [ ] T023 [PR2] Create src/tools/healthcheck.ts implementing ToolConfig pattern with handler logic
- [ ] T024 [PR2] Update src/tools/index.ts to register healthcheck tool
- [ ] T025 [PR2] Update src/index.ts to register healthcheck tool with MCP server
- [ ] T026 [PR2] Run `npm run quality` - all tests must pass

**Checkpoint**: Healthcheck tool complete - User Stories 1 and 2 fully functional, independently testable

---

## PR 3: Quality Gate Validation (User Story 3)

**Objective**: Verify quality gate execution and document quickstart validation

**Behavioral Test Requirements**:
- `npm install` completes without errors on fresh clone
- `npm run quality` passes on valid code (exit code 0)
- `npm run build` produces compiled JavaScript in `dist/`

**Acceptance Criteria**:
- All SC-003 through SC-005 success criteria met
- quickstart.md scenarios validated manually
- Clean slate protocol documented and verified

**Local/CI Checks**: `npm run quality` must pass before merge

**Review Requirements**: Claude Code review; critical/major feedback addressed; 10-minute iteration cycles

### Validation Tasks

- [ ] T027 [PR3] Run clean slate protocol: `npm run clean && rm -rf node_modules && npm install && npm run quality`
- [ ] T028 [PR3] Validate quickstart.md: fresh clone, install, build, quality checks
- [ ] T029 [PR3] Verify Claude Code integration: add MCP config, restart, invoke healthcheck
- [ ] T030 [PR3] Verify echo functionality: invoke healthcheck with echo parameter

**Checkpoint**: All user stories validated, quality gates confirmed working

---

## Dependencies & Execution Order

### PR Dependencies

- **PR 1 (Foundation)**: No dependencies - can start immediately
- **PR 2 (Healthcheck Tool)**: Depends on PR 1 merge - BLOCKS until foundation complete
- **PR 3 (Quality Validation)**: Depends on PR 2 merge - final validation after tool implementation

### Within Each PR

- Tests (if included) MUST be written and FAIL before implementation
- Schemas before tool implementation
- Tool implementation before server registration
- All quality gates must pass before PR creation

### Parallel Opportunities

**PR 1 Setup Phase**:
```bash
# These tasks can run in parallel (different files):
T003: Create biome.json
T004: Create vitest.config.ts
```

**PR 1 Foundational Phase**:
```bash
# T011 can run in parallel with implementation tasks:
T011: Create .github/workflows/ci.yml
```

**PR 2 Tests**:
```bash
# All test tasks can run in parallel (same file but independent test cases):
T013-T020: All healthcheck behavior tests
```

---

## Implementation Strategy

### PR 1: Foundation (MVP-0)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T012)
3. Run `npm run quality` - must pass
4. Create PR via GitHub MCP
5. Claude Code review + 10-minute iteration cycles
6. Merge when all critical/major feedback addressed

### PR 2: Healthcheck Tool (MVP)

1. Write all tests first (T013-T020) - verify they FAIL
2. Implement schemas and tool (T021-T025)
3. Run `npm run quality` - all tests must pass (T026)
4. Create PR via GitHub MCP
5. Claude Code review + 10-minute iteration cycles
6. Merge when all critical/major feedback addressed

### PR 3: Quality Validation

1. Perform clean slate validation (T027)
2. Run quickstart.md validation (T028)
3. Test Claude Code integration (T029-T030)
4. Create PR via GitHub MCP (if any fixes needed)
5. Merge and close feature

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [PR] label maps task to specific PR for traceability
- Tests MUST fail before implementation (TDD)
- `npm run quality` before every commit/push
- No skips, ignores, or bypasses allowed
- 10-minute iteration cycles: implement → quality gates → Claude review → address feedback → repeat
