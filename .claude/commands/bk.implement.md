---
description: "Implement behaviors one at a time using test-first development"
---

# /bk.implement — Execute Behaviors

You are implementing behaviors one at a time using test-first development. The user will provide the feature directory as $ARGUMENTS (e.g., `specs/001-user-login`), or you should identify the current feature from the active branch.

## Gate

Before anything else, run `.behavior-kit/scripts/check-prereqs.sh implement`. If it fails, stop and relay its error message to the user.

## Instructions

1. Read the constitution at `.behavior-kit/memory/constitution.md`
2. Read the behaviors at `specs/NNN-feature-name/behaviors.md`
3. Find the next unimplemented behavior (in dependency order)
4. For each behavior:
   a. **Write the test first** — it must fail
   b. **Implement the minimum code** to make the test pass
   c. **Refactor** if needed (tests must still pass)
   d. **Commit** with message: `B001: [behavior description]`
   e. Move to the next behavior
5. When implementing, let architecture emerge:
   - Need to persist data? Create a model NOW, not before
   - Need shared logic? Extract a helper NOW, not before
   - Need an endpoint? Create a route NOW, not before

## Rules
- One behavior at a time, in dependency order
- Test-first: red → green → refactor
- Each behavior gets its own commit
- Models, services, helpers emerge as needed — never pre-created
- Follow existing codebase patterns discovered in the plan phase

## Forbidden
- Batch implementation (multiple behaviors at once)
- Pre-creating project structure, directories, or boilerplate
- Abstractions "for later" or "for extensibility"
- Skipping the failing test step
- Implementing behaviors out of dependency order

## Output
Working, tested code with one commit per behavior
