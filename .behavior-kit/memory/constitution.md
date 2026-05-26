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

## Article IX — Deterministic Output
Same input must produce same output. Diagrams are reproducible across runs and environments. Non-determinism (timestamps, random IDs, locale-dependent formatting) is a bug, not a feature.

## Article X — MCP Tool Contracts (NON-NEGOTIABLE)
Every MCP tool has explicit input/output JSON schemas, stable and documented error codes, and behavior tests covering valid input, invalid input, renderer failure, timeout, and resource cleanup. Tool contracts are the public API — break them with a major version bump or not at all.

## Article XI — Resource Cleanup
Browser instances, temp files, child processes, and file handles are released on every code path, including failures and timeouts. Leaks are bugs of the same severity as wrong output.

---

Worktrees: enabled
Ratified: 2026-05-26
