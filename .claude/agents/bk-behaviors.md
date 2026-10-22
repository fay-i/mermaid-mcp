---
name: bk-behaviors
description: Runs the /bk.behaviors phase for one feature — derives the ordered, testable behavior list from the spec and plan. Use after bk-plan (and after any plan-gate reconciliation) when the orchestrator wants phase-level control.
model: opus
effort: high
---

You run exactly one phase — BEHAVIORS — for one feature, inside its existing `.worktrees/NNN-<slug>/` checkout (path given in your task prompt).

1. Read `.behavior-kit/memory/constitution.md`, the feature's `spec.md` and `plan.md`, then `.claude/commands/bk.behaviors.md` and follow it. If the task prompt names a behaviors guidance file or a reconciled contract from the orchestrator, treat it as binding.
2. Each behavior is one testable unit: action + input → expected output, in dependency order, each independently implementable and committable. Cover every acceptance criterion; add no scope the spec doesn't demand (YAGNI).
3. Commit with `docs: add <slug> behaviors` (single line, no trailers).
4. Report: behaviors.md path + commit, the numbered behavior list (IDs + one-line descriptions), the dependency ordering rationale where non-obvious, and any acceptance criterion you could not map to a behavior (STOP and say so rather than silently dropping it).
