# Project Constitution

## Article I — Test-Driven Development (NON-NEGOTIABLE)
Every unit of work is a testable behavior: action + input → expected output. Write the test first, confirm it fails, implement the minimum to pass, refactor. No code without a failing test.

## Article II — Epistemic Humility (NON-NEGOTIABLE)
Trust tools over intuition. Run the test, read the error, check the output. Never assume code works — verify it. When uncertain, investigate before acting.

## Article III — Code Is a Liability
Every line of code is a line to maintain, debug, and understand. Less code means fewer bugs, faster onboarding, and easier change. Delete aggressively. Resist adding. The best code is the code you never wrote.

## Article IV — Lean Specification
Specs use Given/When/Then acceptance criteria. They describe WHAT and WHY, never HOW. No data models, no API shapes, no technology choices in specs.

## Article V — Organic Architecture
YAGNI, DRY, SRP. Models, services, and helpers emerge from behavior needs, never pre-planned. Three similar lines are better than a premature abstraction.

## Article VI — No Skips, No Ignores, No Bypasses (NON-NEGOTIABLE)
No skipped tests, no disabled linters, no type ignores, no `--no-verify`. If a check fails, fix the root cause. Quality gates exist for a reason.

## Article VII — Progressive Context
Each phase loads only what it needs. Specify loads the constitution. Plan loads the spec + codebase. Behaviors loads the plan. Implement loads one behavior at a time.

## Article VIII — Self-Documenting Code
Code should be readable without comments. Use clear names, small functions, and obvious structure. Add comments only where the WHY isn't self-evident. DocC/JSDoc for public APIs only.

---

_Add project-specific articles below (Article IX+):_

## Article IX — MCP Tool Contract
Every MCP tool declares explicit input and output JSON schemas and returns stable, documented error codes. Output is deterministic: the same input yields the same output. Behavior tests cover valid input, invalid input, renderer failure, timeout, and resource cleanup.

## Article X — Strict Type Policy
Implementation code never uses `any`, `Partial<T>` as a workaround, or unsafe casts like `as unknown as T`; external data enters as `unknown` and is narrowed. Test code may use `any` or `Partial<T>` for fixtures but must never weaken behavior assertions.

## Article XI — Clean-Slate Gates (NON-NEGOTIABLE)
Before every push: `npm run clean`, a fresh `npm install`, then `npm run quality` (typecheck, lint, format, build, unit, and MCP Inspector integration tests). CI runs the same gates in under 10 minutes with no allow-failure jobs. "It's just a typo" is not an exception.

## Article XII — Atomic PRs with Story Checkpoints (NON-NEGOTIABLE)
Each user story is its own PR, with task IDs, issue links (`Closes #N`), and TDD evidence in the description. After pushing, stop: address all review feedback, re-run the gates, and merge before starting the next story.

Worktrees: enabled
Ratified: 2026-10-22
