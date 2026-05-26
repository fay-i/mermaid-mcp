#!/usr/bin/env bash
set -euo pipefail

# Usage: init-session.sh <tag> <slug>
# <tag>  ∈ {fix, chore, refactor, docs, test, ci, build, perf, style, revert}
#        — a conventional-commit-style prefix the agent picked for the session.
# <slug> — short kebab-case summary of what the session is about (3-5 words).
#
# Sessions are lightweight: no NNN- number, no specs/ artifact. Just a branch
# named {tag}/{slug} and (when worktrees are enabled) a matching worktree at
# .worktrees/{tag}-{slug}. They never go through plan/behaviors/implement —
# check-prereqs.sh refuses those phases on non-feature/ branches.

TAG="${1:?Usage: init-session.sh <tag> <slug>}"
SLUG="${2:?Usage: init-session.sh <tag> <slug>}"

# Whitelist tags so a typo doesn't produce branches like notatag/foo.
case "$TAG" in
  fix|chore|refactor|docs|test|ci|build|perf|style|revert)
    ;;
  *)
    echo "Error: tag '$TAG' is not one of: fix, chore, refactor, docs, test, ci, build, perf, style, revert." >&2
    exit 1
    ;;
esac

# Normalize slug the same way init-feature.sh does so branch names stay sane.
SLUG=$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | tr -s '-')
SLUG=$(echo "$SLUG" | cut -d- -f1-5)
SLUG=${SLUG:0:50}
SLUG=${SLUG#-}
SLUG=${SLUG%-}

if [[ -z "$SLUG" ]]; then
  echo "Error: slug is empty after normalization. Pass 3-5 kebab-case words." >&2
  exit 1
fi

BRANCH="${TAG}/${SLUG}"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Error: branch '$BRANCH' already exists. Pick a different slug or check out the existing branch." >&2
  exit 1
fi

CONSTITUTION=".behavior-kit/memory/constitution.md"
WORKTREES_ENABLED=false
if [[ -f "$CONSTITUTION" ]] && grep -qE '^Worktrees:[[:space:]]*enabled[[:space:]]*$' "$CONSTITUTION"; then
  WORKTREES_ENABLED=true
fi

if $WORKTREES_ENABLED; then
  # Flatten the '/' in the branch name so the path is a single directory entry
  # and can't collide with feature/NNN-slug worktrees (which use NNN-slug only).
  WORKTREE_PATH=".worktrees/${TAG}-${SLUG}"
  if [[ -e "$WORKTREE_PATH" ]]; then
    echo "Error: worktree path '$WORKTREE_PATH' already exists." >&2
    exit 1
  fi
  mkdir -p .worktrees
  git worktree add -b "$BRANCH" "$WORKTREE_PATH" HEAD >/dev/null

  echo "Created branch: $BRANCH"
  echo "Created worktree: $WORKTREE_PATH"
  echo ""
  echo "Next: cd $WORKTREE_PATH  (the session lives entirely inside this worktree)"
  echo "$WORKTREE_PATH"
else
  git checkout -b "$BRANCH"
  echo "Created branch: $BRANCH"
  echo "."
fi
