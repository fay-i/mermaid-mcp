<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0 (minor: added Epistemic Humility, enhanced CI-First)
Modified principles:
  - II. CI-First Local Verification → III. (renumbered, enhanced with Clean Slate Protocol)
  - All principles III-X renumbered to IV-XI
Added sections:
  - I. Epistemic Humility (NON-NEGOTIABLE)
  - Clean Slate Protocol in CI-First Local Verification
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ Compatible
  - .specify/templates/spec-template.md: ✅ Compatible
  - .specify/templates/tasks-template.md: ✅ Compatible
  - CLAUDE.md: ✅ Created (new file)
Follow-up TODOs: None
-->

# Mermaid Printer Constitution

## Core Principles

### I. Epistemic Humility (NON-NEGOTIABLE)

**The problem is ALWAYS in YOUR code.** When the tooling, compiler, linter, or test runner says something is wrong, assume IT is right and YOU are wrong. Do not argue with the tools.

**Be skeptical of yourself:**
- You cannot "run" code mentally. You can only guess.
- Your guesses are often wrong. The tools are rarely wrong.
- If a test fails, the test is telling you something. Listen.
- If the compiler rejects your code, the compiler is correct. Fix YOUR code.
- If the linter warns you, the linter knows something you forgot. Heed the warning.

**Never dismiss tool output:**
- "That's a false positive" → It almost never is. Investigate properly.
- "That test is flaky" → The test is exposing a real race condition. Fix it.
- "The linter is being pedantic" → The linter is preventing future bugs. Comply.
- "It works on my machine" → You're not running in CI. Run the full check suite.

**The only way to KNOW if code works is to RUN THE CHECKS.** You cannot know otherwise.

**Proven confidence vs. false confidence:**
- **False confidence**: "This should work" / "I'm confident this is correct" / "The logic looks right"
- **Proven confidence**: "All tests pass" / "The linter found no issues" / "TypeScript compiles cleanly"

False confidence causes missed critical gaps. We ship tests with unimplemented stubs and wonder why CI fails. We push code that "looks right" but has subtle bugs the type checker would have caught. The instrumentation is your proof. Without it, confidence is just hope.

### II. TDD by Behavior (NON-NEGOTIABLE)

No implementation code MUST exist without a failing test first. Tests MUST validate **behavior**—contracts, error mapping, cleanup, timeouts, determinism—not internal structure.

- Every code change follows: **Problem statement → Failing test → Minimal code → Pass**
- Red → Green → Refactor, one behavior at a time
- Tests MUST assert observable outcomes, NEVER implementation details
- A test that cannot fail is not a test; delete it

### III. CI-First Local Verification (NON-NEGOTIABLE)

**Working software is the only success metric.** CI is the source of truth. Before EVERY push to remote, you MUST run ALL CI checks locally from a clean slate. A broken CI check is a preventable failure. Prevent it.

**The Clean Slate Protocol** — Before every `git push`:

```bash
# 1. Clean all build artifacts
npm run clean  # or yarn clean

# 2. Fresh dependency installation (like ephemeral CI runner)
rm -rf node_modules && npm install  # or yarn install

# 3. Run ALL quality checks (single command)
npm run quality  # tests, typecheck, lint, format check, build
```

**There are NO exceptions:**
- "I only changed a comment" → Run the checks
- "It's just a typo fix" → Run the checks
- "The CI will catch it" → You catch it first
- "It wasn't my changes" → If it fails, fix it before pushing

- No excuses. No exceptions. No "it works on my machine."
- Local gates MUST mirror CI gates exactly
- If local passes but CI fails, local gates are broken—fix them immediately

### IV. No Skips, No Ignores, No Bypasses (NON-NEGOTIABLE)

NEVER use test skips, lint disables, `// @ts-ignore`, `// eslint-disable`, `// prettier-ignore`, or similar bypasses.

- "Passing" means passing without hacks
- If a rule is wrong, fix the rule globally; do not suppress it locally
- Disabled tests MUST be deleted, not skipped

### V. Type Policy

Implementation code and test code have different strictness levels.

**Implementation code (strict)**:
- NO `any` type
- NO `Partial<T>` as a workaround for incomplete data
- NO unsafe casts (`as unknown as T`)
- Use `unknown` with proper type narrowing when dealing with external data

**Test code (pragmatic)**:
- MAY use `any` or `Partial<T>` for test fixtures
- MUST NOT weaken real behavior assertions
- Type shortcuts are for convenience, not for hiding bugs

### VI. Tool Contract Discipline

MCP tools MUST have explicit, stable contracts.

- Every tool MUST define input/output JSON schemas
- Every tool MUST use stable, documented error codes
- Every tool MUST have behavior tests covering:
  - Valid input → expected output
  - Invalid input → appropriate error
  - Renderer failure → graceful degradation
  - Timeout → cleanup and error
  - Resource cleanup → no leaks
- Outputs MUST be deterministic: same Mermaid + same options = same output

### VII. PR Structure and Review Governance (NON-NEGOTIABLE)

Work is delivered in atomic, reviewable units.

- Foundational setup (project scaffold, CI, tooling) is its own PR
- Each MCP tool is its own PR
- PRs MUST be created via GitHub MCP with complete-but-concise descriptions
- All commits are reviewed by Claude Code
- All critical/major feedback MUST be addressed before merge
- PRs MUST NOT bundle unrelated changes

### VIII. Iteration Loop Discipline

Work proceeds in explicit cycles. After pushing, wait up to 10 minutes for CI and Claude Code review to complete, poll for feedback, then react.

**The Loop**:
1. Problem statement (what behavior are we adding/fixing?)
2. Tests (write failing test for that behavior)
3. Minimal code (make the test pass, nothing more)
4. Run local gates (must pass)
5. Push and wait (up to 10 minutes for CI + Claude Code review)
6. Poll for feedback
7. Outcome: PASS → done | Feedback → new problem statement → repeat

- PRs MUST document iteration loops briefly to prove discipline
- The 10-minute window is for CI/review completion, not idle time
- React to feedback immediately once received
- Loops continue until PASS with no outstanding issues

### IX. CI in GitHub Actions

GitHub Actions runs on all pull requests and on pushes to `main` only.

- CI runtime target: < 10 minutes
- Caching MUST be used to avoid redundant work
- NO `continue-on-error: true` or "allow failure" configurations
- CI MUST run the same gates as local verification
- Any CI failure blocks merge

### X. Local Gates Before Commit/Push (NON-NEGOTIABLE)

A single command MUST exist that runs all quality checks.

**The command MUST run**:
- All tests
- Type checking
- Linting
- Format checking
- Build (if applicable)

- Developers MUST run this command before every commit/push
- CI MUST run this exact command
- The command MUST exit non-zero on any failure

### XI. Task Derivation Rule

Tasks are derived from plans; they are never invented in isolation.

- `/speckit.tasks` MUST derive tasks from `/speckit.plan` output
- The constitution defines rules, not tasks
- The spec defines contracts and requirements (what)
- The plan defines architecture and approach (how)
- Tasks are work items derived from the plan (do)
- No "invented tasks" that bypass spec → plan → tasks flow

## Enforcement Checklist

### Local Gates (before every commit/push)

- [ ] Clean Slate Protocol executed (clean, fresh install, quality command)
- [ ] Quality command passes (tests, types, lint, format, build)
- [ ] No skipped tests, no lint disables, no type ignores
- [ ] All new code has corresponding behavior tests
- [ ] Tests fail before implementation, pass after

### CI Gates (automated on every PR)

- [ ] Same quality command as local
- [ ] No allow-failure jobs
- [ ] Runtime < 10 minutes
- [ ] Merge blocked on any failure

### PR Gates (before merge)

- [ ] Atomic scope (one tool or one concern per PR)
- [ ] Complete description via GitHub MCP
- [ ] Iteration loops documented
- [ ] All critical/major review feedback addressed
- [ ] CI passing

## Amendments

Changing this constitution requires:

1. Explicit rationale documenting why the change is needed
2. Impact assessment on existing specs, plans, and tasks
3. Owner sign-off for any change to NON-NEGOTIABLE principles
4. Version increment following semantic versioning:
   - MAJOR: Removing or fundamentally changing a principle
   - MINOR: Adding new principles or significant expansions
   - PATCH: Clarifications, typo fixes, non-semantic refinements

NON-NEGOTIABLE principles (I, II, III, IV, VII, VIII, X) MUST NOT be weakened without explicit owner sign-off and documented exceptional circumstances.

---

**Version**: 1.1.0 | **Ratified**: 2025-12-30 | **Last Amended**: 2025-12-30
