---
description: "Start a lightweight pairing session — branch + worktree, no spec/plan/behaviors workflow"
---

# /bk.session — Pairing / One-off Session

You are starting a lightweight, interactive session with the user — a one-off fix, a refactor pass, a QA round, anything that doesn't warrant the full spec → plan → behaviors → implement pipeline. The user may pass the session's purpose as $ARGUMENTS; if they don't, ask them.

## Gate

Before anything else, run `.behavior-kit/scripts/check-prereqs.sh session`. If it fails, stop and relay its error message to the user.

## Instructions

1. Read the constitution at `.behavior-kit/memory/constitution.md` — it governs this session the same way it governs spec work.
2. **Establish the purpose.** If $ARGUMENTS is non-empty, treat it as the session's purpose. Otherwise ask the user one inline question: *"What's this session for? (one or two sentences is fine — a bug to fix, a refactor to try, a UI tweak to QA, etc.)"* Wait for their answer.
3. **Pick a conventional-commit tag** that best matches the purpose. Choose from: `fix`, `chore`, `refactor`, `docs`, `test`, `ci`, `build`, `perf`, `style`, `revert`. Do not use `feat` — that's `/bk.specify`'s domain. If the purpose genuinely sounds like a new feature, stop and suggest `/bk.specify` instead.
4. **Derive a short slug** — 3-5 kebab-case words summarizing the purpose (e.g. `login-redirect-loop`, `bump-node-22`, `extract-auth-helper`).
5. Run `.behavior-kit/scripts/init-session.sh <tag> "<slug>"`. The script creates the `{tag}/{slug}` branch and — when worktrees are enabled — a matching `.worktrees/{tag}-{slug}/` checkout. Its last line is the path to operate in.
6. **When worktrees are enabled**, tell the user to `cd` into the new worktree path before continuing. All work for this session lives there.
7. From that point on, **pair with the user freely**. There is no behaviors.md, no test-first ceremony, no commit-per-behavior. Use your normal judgment for tests, commits, and scope — but the constitution still applies (Article I TDD where it makes sense, Article II epistemic humility always, etc.).

## Rules
- One purpose per session. If the conversation drifts to unrelated work, suggest ending this session and starting another.
- The branch name carries the intent — make the tag and slug accurate, since they'll show up in `git log` and any PR you open later.
- Sessions never enter the spec workflow. `check-prereqs.sh` will refuse `/bk.plan`, `/bk.behaviors`, `/bk.implement`, and `/bk.iterate` on a `{tag}/{slug}` branch — that's intentional.

## Forbidden
- Using the `feat` tag (route real features through `/bk.specify`).
- Writing a `specs/NNN-…/` or `sessions/…/` markdown artifact — sessions are deliberately ephemeral.
- Running other `/bk.*` phases on the session branch.

## Output
A `{tag}/{slug}` branch (and matching worktree when enabled), ready for interactive pairing.
