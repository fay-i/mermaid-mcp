# Mermaid Printer MCP Server — AI Agent Guidelines

This document enforces the project constitution for AI agents. Read `.specify/memory/constitution.md` for the full governance rules.

## Project Overview

Node.js MCP server that parses Mermaid diagram source and produces vector artifacts (SVG primary; optional PDF).

## Non-Negotiable Operating Principles

### 1. Epistemic Humility — Trust the Tools, Not Yourself

**The problem is ALWAYS in YOUR code.** When the tooling, compiler, linter, or test runner says something is wrong, assume IT is right and YOU are wrong.

- You cannot "run" code mentally. You can only guess. Your guesses are often wrong.
- If a test fails → the test is telling you something. Listen.
- If the compiler rejects your code → the compiler is correct. Fix YOUR code.
- If the linter warns you → the linter knows something you forgot. Heed the warning.

**Never dismiss tool output:**
- "That's a false positive" → It almost never is. Investigate properly.
- "That test is flaky" → The test is exposing a real race condition. Fix it.
- "The linter is being pedantic" → The linter is preventing future bugs. Comply.

**Proven confidence vs. false confidence:**
- **False**: "This should work" / "I'm confident this is correct" / "The logic looks right"
- **Proven**: "All tests pass" / "The linter found no issues" / "TypeScript compiles cleanly"

**The only way to KNOW if code works is to RUN THE CHECKS.**

### 2. TDD by Behavior — Tests First, Always

No implementation code without a failing test first. Tests validate **behavior**, not internal structure.

**The cycle**: Problem statement → Failing test → Minimal code → Pass → Refactor

- Tests MUST assert observable outcomes, NEVER implementation details
- A test that cannot fail is not a test; delete it

### 3. Clean Slate Protocol — Before Every Push

Before EVERY `git push`, run the full CI suite locally from a clean slate:

```bash
# 1. Clean all build artifacts
npm run clean

# 2. Fresh dependency installation
rm -rf node_modules && npm install

# 3. Run ALL quality checks
npm run quality
```

**There are NO exceptions:**
- "I only changed a comment" → Run the checks
- "It's just a typo fix" → Run the checks
- "The CI will catch it" → You catch it first

### 4. No Bypasses — Ever

NEVER use:
- `test.skip()`, `it.skip()`, `describe.skip()`
- `// @ts-ignore`, `// @ts-expect-error` (without immediate fix)
- `// eslint-disable`, `// eslint-disable-next-line`
- `// prettier-ignore`
- `continue-on-error: true` in CI

If a rule is wrong, fix the rule globally. Do not suppress locally.

## Development Workflow

### Iteration Loop (10-minute cycles)

1. **Problem statement** — What behavior are we adding/fixing?
2. **Tests** — Write failing test for that behavior
3. **Minimal code** — Make the test pass, nothing more
4. **Run local gates** — Must pass
5. **Push and wait** — Up to 10 minutes for CI + Claude Code review
6. **Poll for feedback**
7. **Outcome** — PASS → done | Feedback → new problem statement → repeat

### PR Structure

- Foundational setup → its own PR
- Each user story → its own PR
- Polish/cross-cutting concerns → its own PR
- PRs MUST be atomic (one concern per PR)
- PRs MUST document iteration loops briefly

### PR Description Protocol

Every PR description MUST include:

1. **Task References** — List all task IDs (e.g., T001, T002) completed in this PR
2. **GitHub Issue Links** — Reference issues with `Closes #XX` or `Relates to #XX`
3. **User Story Context** — Which user story this PR completes (if applicable)
4. **Test Evidence** — Confirmation that tests were written first and failed before implementation

Example PR description:
```markdown
## Summary
Implements User Story 1: Generate PDF from Mermaid Diagram

## Tasks Completed
- T007: Contract test for input validation
- T008: Contract test for success output structure
- T013-T020: Core implementation

Closes #20, #21, #26, #27, #28, #29, #30, #31, #32, #33

## Test Evidence
All tests written first and verified failing before implementation per TDD protocol.
```

### User Story PR Workflow — MANDATORY

**Each user story MUST be a separate PR with a remediation checkpoint:**

1. **Complete User Story N** — All tests + implementation for that story
2. **Create PR** — Include task references and issue links
3. **Push and Wait** — Wait for CI + review feedback
4. **STOP** — Do NOT proceed to next user story
5. **Remediate** — Address all feedback, re-run quality gate
6. **Merge** — Only after PR approved and CI green
7. **THEN** — Proceed to User Story N+1

```text
┌─────────────────┐
│  User Story 1   │
│  (Setup + US1)  │
└────────┬────────┘
         │ PR → Review → Remediate → Merge
         ▼
┌─────────────────┐
│  User Story 2   │
└────────┬────────┘
         │ PR → Review → Remediate → Merge
         ▼
┌─────────────────┐
│  User Story 3   │
└────────┬────────┘
         │ PR → Review → Remediate → Merge
         ▼
┌─────────────────┐
│     Polish      │
└─────────────────┘
```

**Why forced checkpoints?**
- Prevents accumulating technical debt across stories
- Ensures each story is independently shippable
- Catches integration issues early
- Maintains code quality throughout feature development

**NO EXCEPTIONS:** Do not batch multiple user stories into one PR. Do not start the next user story until the current PR is merged.

## Commands

```bash
# Quality gate (run before every push)
npm run quality        # typecheck + lint + format + build + test + test:integration

# Individual checks
npm run test           # Run unit tests (Vitest)
npm run test:integration  # Run MCP integration tests (Inspector CLI)
npm run typecheck      # TypeScript type checking
npm run lint           # Biome linting
npm run format:check   # Biome format check
npm run build          # Build the library

# Clean slate
npm run clean          # Remove build artifacts
```

## Integration Testing

Integration tests verify the MCP server works end-to-end using the MCP Inspector CLI. They are **mandatory** and run as part of `npm run quality`.

```bash
# Run integration tests manually
npm run test:integration

# Or use MCP Inspector CLI directly
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name healthcheck
```

Integration tests verify:
- Server starts and responds to MCP protocol
- Tools are discoverable via `tools/list`
- Tool invocations return expected responses
- Echo functionality works correctly

## Type Policy

**Implementation code (strict):**
- NO `any` type
- NO `Partial<T>` as workaround
- NO unsafe casts (`as unknown as T`)
- Use `unknown` + narrowing for external data

**Test code (pragmatic):**
- MAY use `any` or `Partial<T>` for fixtures
- MUST NOT weaken behavior assertions

## MCP Tool Requirements

Every MCP tool MUST have:
- Explicit input/output JSON schemas
- Stable, documented error codes
- Behavior tests covering:
  - Valid input → expected output
  - Invalid input → appropriate error
  - Renderer failure → graceful degradation
  - Timeout → cleanup and error
  - Resource cleanup → no leaks
- Deterministic output (same input = same output)

## Project Structure

```text
src/
├── tools/           # MCP tool implementations
├── renderer/        # Mermaid rendering logic
├── schemas/         # JSON schemas for tool I/O
└── index.ts         # MCP server entry point

tests/
├── behavior/        # Behavior tests (contracts, errors, cleanup)
└── fixtures/        # Test fixtures (Mermaid sources)
```

## CI/CD

- GitHub Actions on all PRs and pushes to `main`
- Runtime target: < 10 minutes
- Same gates as local quality command
- Any failure blocks merge
- No allow-failure jobs

## Constitution Reference

Full governance rules: `.specify/memory/constitution.md` (v1.2.0)

NON-NEGOTIABLE principles:
- I. Epistemic Humility
- II. TDD by Behavior
- III. CI-First Local Verification
- IV. No Skips/Ignores/Bypasses
- VII. PR Structure and Review Governance
- VIII. Iteration Loop Discipline
- X. Local Gates Before Commit/Push

## Active Technologies
- TypeScript 5.x, Node.js 24+, ESM modules + `@modelcontextprotocol/sdk`, `zod` (schema validation) (001-mcp-hello-world)
- N/A (stateless healthcheck tool) (001-mcp-hello-world)
- TypeScript 5.x, Node.js 24+ (ESM modules) + `@modelcontextprotocol/sdk`, `zod`, `puppeteer`, `mermaid`, `jspdf`, `svg2pdf.js` (003-mermaid-to-pdf)
- N/A (stateless tool, base64 output) (003-mermaid-to-pdf)
- TypeScript 5.x, Node.js 24+ (ESM modules) + `@modelcontextprotocol/sdk` ^1.24.0, `zod` ^4.3.4, `puppeteer` ^23.11.1 (007-session-artifact-cache)
- File system (OS temp directory: `$TMPDIR/mermaid-mcp-cache`) (007-session-artifact-cache)

## Recent Changes
- 001-mcp-hello-world: Added TypeScript 5.x, Node.js 24+, ESM modules + `@modelcontextprotocol/sdk`, `zod` (schema validation)
