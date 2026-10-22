---
name: bk-monitor
description: Monitor a pull request's automated review loop - wait for the CodeRabbit review round, fix every critical and major finding (and sensible minors), keep the PR mergeable (conflicts never show as failed checks - query merge state explicitly), reply to each thread, push, and repeat until a round yields zero new critical/major findings, all status checks are green, and GitHub reports the PR mergeable. Use when asked to monitor, babysit, or drive a PR to merge-readiness.
---

# bk-monitor — PR Review Monitor Loop

You are monitoring a pull request until it is merge-ready. Input: a PR number (and repo, if not the current one).

> **Codex note:** invoke this skill as `/bk-monitor` (Codex slash names can't contain dots).

## The loop

1. **Wait for the CodeRabbit review round.** Poll the PR — reviews and comments authored by `coderabbitai` / `coderabbitai[bot]` — until the round covering the latest push is posted. Watch status checks alongside (`gh pr checks`). Use bounded waits between polls (~60–90s). If no review activity appears within 15 minutes of the last push, post `@coderabbitai review` once to trigger a round; if still nothing after another 15 minutes, stop and escalate.
2. **Check merge state every round.** Merge conflicts do NOT appear as failing status checks — query them explicitly: `gh pr view <N> --json mergeable,mergeStateStatus`. A PR is not merge-ready while GitHub reports `mergeable: CONFLICTING` (or `mergeStateStatus: DIRTY`).
   - If the conflict exists because the base branch advanced legitimately: update the PR branch — merge the base into it (prefer merge over rebase to preserve review history; if a rebase is unavoidable, announce it in a PR comment), resolve conflicts faithfully to both sides' intent, re-run the repo's full checks locally, push, and continue the loop.
   - If the conflict stems from something wrong on the base itself (reverted/corrupted content, restructuring outside this PR's scope): ESCALATE — do not reconstruct out-of-scope content inside the PR branch.
3. **Triage findings by severity.** CodeRabbit severities are **trivial / minor / major / critical**.
   - **Critical and major findings MUST all be addressed** — fixed, or rebutted with concrete evidence if wrong.
   - **Minor findings are at your discretion**: apply the sensible ones (safe, clearly an improvement); decline the rest in a reply with a short reason.
   - **Trivial findings** are optional; decline or acknowledge briefly.
4. **Fix on the PR branch.** Constitution rules hold: TDD for behavior changes (red → green), no skips/ignores/bypasses, single-line commits `type: subject` (no bodies, no trailers). Run the repo's full checks locally before pushing.
5. **Respond to every critical/major thread** (and every minor you acted on or declined). Reply describing the fix and referencing the commit — or, if the finding is wrong, a concrete technical rebuttal with evidence. No critical or major thread may be left unanswered.
6. **Push and wait for the follow-up round.** CodeRabbit re-reviews on push. Repeat from step 1.

## Exit conditions

- **Success:** a full review round produces zero new critical or major findings AND all status checks are green (SKIPPED is non-blocking) AND GitHub reports the PR mergeable (`mergeable: MERGEABLE`, `mergeStateStatus` not `DIRTY`). All three, verified in the same pass — checks and review state alone are NOT sufficient. Report: rounds run, findings fixed (with commits), findings declined (with reasons), final check + merge state.
- **Stop and escalate** (report to the orchestrator/owner; never loop forever): more than 5 review rounds; a finding demands a design change beyond the PR's scope; checks fail for reasons unrelated to the PR; base-branch conflicts outside the PR's scope (step 2); CodeRabbit unresponsive per step 1.

## Rules

- NEVER merge the PR yourself — merging is the owner's decision.
- Never force-push over review history unless a rebase onto the base branch is required; when you must, say so in a PR comment.
- Never dismiss or resolve a review thread without a substantive reply.
