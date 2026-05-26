---
description: "Generate a behavior-first spec with Given/When/Then acceptance criteria"
---

# /bk.specify — The WHAT and WHY

You are writing a feature specification. The user will provide a feature description as $ARGUMENTS.

## Gate

Before anything else, run `.behavior-kit/scripts/check-prereqs.sh specify`. If it fails, stop and relay its error message to the user.

## Instructions

1. Read the constitution at `.behavior-kit/memory/constitution.md`
2. Derive a short feature name — a 3-5 word kebab-case summary of the feature, **not** the full description (e.g. `create-grow-screen`). Run `.behavior-kit/scripts/init-feature.sh "<short-feature-name>"` to create the feature branch and directory. The script assigns the next sequential number — every spec gets a unique, monotonically increasing number regardless of feature name. The script truncates over-long input defensively, but you must still pass a concise summary. **When the constitution has `Worktrees: enabled`, the script also creates a dedicated `.worktrees/NNN-<slug>/` checkout and the spec directory lives inside it; the last line of the script's output is the full path to that spec directory. `cd` into the worktree before running any further `/bk.*` commands so they operate on the feature branch in isolation.**
3. Read the spec template at `.behavior-kit/templates/spec-template.md`
4. Ask the user up to 3 inline clarification questions if needed (do not stop to wait — batch them)
5. Write the spec to `specs/NNN-feature-name/spec.md`

## Rules
- User story format: As a [role], I want to [action], So that [outcome]
- Every acceptance criterion uses Given/When/Then
- Include edge cases and out-of-scope sections
- Max 3 inline clarification questions — no separate clarify phase

## Forbidden
- Technology mentions (frameworks, languages, databases)
- Data models or schemas
- API shapes or endpoint definitions
- FR-tables or numbered requirement lists
- Implementation checklists

## Output
`specs/NNN-feature-name/spec.md`
