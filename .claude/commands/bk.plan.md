---
description: "Research existing codebase context for a feature spec"
---

# /bk.plan — The CONTEXT (Research Only)

You are researching the codebase to provide context for implementing a feature. The user will provide the feature directory as $ARGUMENTS (e.g., `specs/001-user-login`), or you should identify the current feature from the active branch.

## Gate

Before anything else, run `.behavior-kit/scripts/check-prereqs.sh plan`. If it fails, stop and relay its error message to the user.

## Instructions

1. Read the constitution at `.behavior-kit/memory/constitution.md`
2. Read the spec at `specs/NNN-feature-name/spec.md`
3. **Dependency / duplication gate (REQUIRED — before any codebase research).** Enumerate every other in-flight spec to make sure this one isn't duplicating effort or silently depending on work that hasn't landed yet:
   - List sibling spec dirs with `ls -1d specs/[0-9]*-*` and inspect the union of their `spec.md`, `plan.md`, and `behaviors.md` files (some will not exist yet — that's fine).
   - Also enumerate active worktrees via `git worktree list` so you can see which specs are being worked on right now.
   - For each sibling, decide whether the current spec **(a) overlaps in scope** (would re-implement the same behavior, file, screen, or model), **(b) depends on an unmerged artifact** (needs a type, component, repository, migration, route, or test helper that another in-flight spec is introducing), or **(c) is independent**.
   - If you find any (a) or (b) match, **STOP and force a turn with the user** via `AskUserQuestion`. Quote the sibling spec ID and the specific overlap/dependency, and offer the obvious choices (e.g. "wait for spec NNN to merge", "absorb spec NNN's work into this branch", "narrow this spec to exclude X", "proceed anyway — overlap is intentional"). Do not proceed to step 4 until the user answers.
   - Record the decision in the plan's "Dependencies / coordination" section so the next phase can see it; for every sibling spec considered, note the verdict (independent / overlaps / depends-on) so a reviewer can audit the check.
4. Read the plan template at `.behavior-kit/templates/plan-template.md`
5. Explore the existing codebase thoroughly:
   - Identify patterns and conventions already in use
   - Find code that the feature will interact with
   - Note external dependencies or contracts
6. Write the plan to `specs/NNN-feature-name/plan.md`

## Rules
- Document EXISTING patterns, not proposed ones
- Reference snippets come from EXISTING code only
- Open questions must include a proposed answer
- This is research, not design

## Forbidden
- Inventing data models or schemas
- Proposing API contracts or endpoint shapes
- Suggesting project structure or new directories
- Writing new code or pseudocode
- Making architectural decisions not already present in the codebase

## Output
`specs/NNN-feature-name/plan.md`
