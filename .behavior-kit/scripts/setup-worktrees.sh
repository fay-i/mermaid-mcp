#!/usr/bin/env bash
set -euo pipefail

# Sets up a .worktrees/ directory inside the project root for running parallel
# agents on separate feature branches. The directory lives INSIDE the root
# (not adjacent to it) because AI assistants are typically sandboxed to the
# project directory and cannot reach sibling paths. Git itself is happy with
# a worktree living inside the same repo as long as the path is gitignored.
#
# Usage: setup-worktrees.sh

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not a git repository." >&2
  exit 1
fi

WORKTREES_DIR=".worktrees"
GITIGNORE=".gitignore"

mkdir -p "$WORKTREES_DIR"

# Add gitignore entry idempotently. We ignore the directory contents rather
# than the directory itself, leaving room to track a placeholder later if
# desired without rewriting the rule.
touch "$GITIGNORE"
if grep -qE '^\.worktrees/?$|^\.worktrees/\*$' "$GITIGNORE"; then
  echo ".worktrees/ already excluded in $GITIGNORE"
else
  {
    echo ""
    echo "# behavior-kit: parallel-agent worktrees (kept inside project root"
    echo "# so sandboxed AI assistants can reach them)"
    echo ".worktrees/"
  } >> "$GITIGNORE"
  echo "Added .worktrees/ to $GITIGNORE"
fi

cat <<'EOF'

Worktrees enabled.

Create a worktree for a feature branch with:
  git worktree add .worktrees/<short-name> <branch>

List active worktrees:
  git worktree list

Remove one when you're done:
  git worktree remove .worktrees/<short-name>
EOF
