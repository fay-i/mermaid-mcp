---
name: bk-behaviors
description: Decompose acceptance criteria into atomic, testable behaviors. Invoke after /bk-plan, before /bk-implement.
---

# bk-behaviors — The HOW (as Testable Behaviors)

You are decomposing a feature spec into atomic, testable behaviors. The user will provide the feature directory as $ARGUMENTS (e.g., `specs/001-user-login`), or you should identify the current feature from the active branch.

> **Codex note:** invoke this skill as `/bk-behaviors` (Codex slash names can't contain dots).

## Gate

Before anything else, run `.behavior-kit/scripts/check-prereqs.sh behaviors`. If it fails, stop and relay its error message to the user.

## Instructions

1. Read the constitution at `.behavior-kit/memory/constitution.md`
2. Read the spec at `specs/NNN-feature-name/spec.md`
3. Read the plan at `specs/NNN-feature-name/plan.md`
4. Read the behavior template at `.behavior-kit/templates/behavior-template.md`
5. For each acceptance criterion, decompose into atomic behaviors:
   - Each behavior: Action + Input + Output + Test mapping
   - Add branches for error cases, empty states, edge cases
   - Order by dependency (not by layer)
6. Build a coverage matrix: every AC must map to at least one behavior
7. Write to `specs/NNN-feature-name/behaviors.md`

## Behavior Format

```markdown
## B001: [Action verb phrase]
**From**: AC-1 | **Depends on**: —
**Action**: [What the system does]
**Input**: [Named inputs with types]
**Output**: [Expected result]
**Test**: Given [precondition], when [action], then [result]

### Branches
- **B001a: [Variant name]**
  Input: [variant input] | Output: [variant output] | Test: [...]
```

## Rules
- B-numbers (B001, B002...), not T-numbers
- Branches are first-class (B001a, B001b...)
- Every behavior has a "From" tracing back to an AC
- Every AC must be covered in the coverage matrix
- Order by dependency, not by implementation layer

## Forbidden
- Organizing by layer (models → services → controllers)
- Specifying file paths or module names
- "Setup" or "scaffolding" tasks
- Implementation hints or technology choices
- Phase grouping (Phase 1, Phase 2...)

## Output
`specs/NNN-feature-name/behaviors.md`
