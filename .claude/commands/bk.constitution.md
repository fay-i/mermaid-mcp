---
description: "Create or update project constitution with behavior-first principles"
---

# /bk.constitution — Project Principles

You are setting up or updating the project constitution.

## Instructions

1. **Worktree decision (REQUIRED — ask first, before anything else).** Check whether the constitution already records a decision:

   ```bash
   grep -E '^Worktrees:' .behavior-kit/memory/constitution.md || true
   ```

   If a `Worktrees:` line is missing, ask the user this single question and wait for their answer before continuing:

   > Do you want to use **git worktrees** for parallel agents? This lets multiple Claude/Cursor sessions work on different features at the same time without stepping on each other's branches.
   >
   > - **yes** — recommended if you plan to run more than one agent at a time. behavior-kit will create a gitignored `.worktrees/` directory **inside** the project root (kept inside the root so sandboxed AI assistants can reach it; the usual adjacent-to-root layout is unreachable when an assistant is scoped to the project directory).
   > - **no** — single-branch workflow; agents share the working tree.

   Record the answer in the constitution as a single line above the `Ratified:` line: either `Worktrees: enabled` or `Worktrees: disabled`. If the user chose **enabled**, run `.behavior-kit/scripts/setup-worktrees.sh` to create the directory and update `.gitignore`.

2. Read the current constitution at `.behavior-kit/memory/constitution.md`
3. If this is a new project, present Articles I-V (the defaults) and explain each briefly
4. Ask the user (max 3 questions inline) what project-specific principles to add as Articles VI+
5. Update the constitution file with any new articles
6. Add or update the ratified line at the bottom of the file: `Ratified: YYYY-MM-DD`

## Rules
- The worktree decision must be recorded before any other phase will run (`check-prereqs.sh` enforces this). Never skip step 1.
- Articles I-V are foundational — they can be amended but not removed
- Project-specific articles go in VI+ section
- Keep articles concise: one principle per article, 2-3 sentences max
- The constitution is referenced by all other phases — keep it authoritative

## Output
Updated `.behavior-kit/memory/constitution.md` (with `Worktrees:` and `Ratified:` lines). If worktrees were enabled, `.worktrees/` directory exists and `.gitignore` excludes it.
