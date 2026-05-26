#!/usr/bin/env bash
set -euo pipefail

# Usage: init-feature.sh <feature-name>
# <feature-name> should be a short summary (3-5 words); it becomes the branch
# slug and spec directory name. Over-long input is truncated defensively so a
# full feature description can never produce an unusable branch name.
# Creates a numbered feature branch and spec directory.

FEATURE_NAME="${1:?Usage: init-feature.sh <feature-name>}"
SLUG=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | tr -s '-')

# Keep the slug short: cap at 5 words and 50 chars, trimmed to a word boundary
SLUG=$(echo "$SLUG" | cut -d- -f1-5)
SLUG=${SLUG:0:50}
SLUG=${SLUG#-}
SLUG=${SLUG%-}

# Find the next feature number by taking the max across every source that
# could possibly have already used one:
#   1. Local spec directories (specs/NNN-*)
#   2. Local branches            (refs/heads/feature/NNN-*)
#   3. All remote branches       (refs/remotes/*/feature/NNN-*)
#   4. Tags                      (refs/tags/feature/NNN-*)
#   5. Commit-message history    (catches branches that were merged & deleted)
SPECS_DIR="specs"
mkdir -p "$SPECS_DIR"

# Refresh remotes so step 3 is up-to-date. We loudly warn (rather than silently
# swallow) failures because stale remote data is the main way two contributors
# end up choosing the same number.
if ! git fetch --all --quiet 2>/dev/null; then
  echo "Warning: 'git fetch --all' failed — remote branch numbers may be stale. The next feature number may collide with one already taken on another remote." >&2
fi

# 1. Local spec directories
LOCAL_SPEC_NUMS=$(ls -1d "$SPECS_DIR"/[0-9]*-* 2>/dev/null \
  | sed 's|.*/||' \
  | grep -oE '^[0-9]+' || true)

# 2-4. Every ref (local heads + all remotes + tags) shaped like feature/NNN-*
REF_NUMS=$(git for-each-ref --format='%(refname:short)' \
    refs/heads refs/remotes refs/tags 2>/dev/null \
  | grep -oE 'feature/[0-9]+-' \
  | grep -oE '[0-9]+' || true)

# 5. Commit history. --grep narrows the log walk so this stays fast on large
#    repos; we still scan subject + body for the feature/NNN- substring, which
#    catches squash-merge commits whose default message names the source branch.
LOG_NUMS=$(git log --all --grep='feature/[0-9]\+-' --format='%s %b' 2>/dev/null \
  | grep -oE 'feature/[0-9]+-' \
  | grep -oE '[0-9]+' || true)

LAST=$(printf '%s\n%s\n%s\n' "$LOCAL_SPEC_NUMS" "$REF_NUMS" "$LOG_NUMS" \
  | { grep -E '^[0-9]+$' || true; } \
  | sort -n \
  | tail -1)
LAST=${LAST:-0}
NEXT=$(printf "%03d" $((10#$LAST + 1)))

FEATURE_DIR="$SPECS_DIR/${NEXT}-${SLUG}"
BRANCH="feature/${NEXT}-${SLUG}"

# Defense-in-depth: if the computed name still collides (race with a parallel
# agent, gitignored spec dir, ref we somehow missed), bump and retry instead
# of crashing in `git checkout -b`.
ATTEMPTS=0
while git show-ref --verify --quiet "refs/heads/$BRANCH" \
   || git show-ref --verify --quiet "refs/tags/$BRANCH" \
   || [[ -d "$FEATURE_DIR" ]]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if (( ATTEMPTS > 100 )); then
    echo "Error: gave up after 100 attempts to find an unused feature number starting from $NEXT." >&2
    exit 1
  fi
  NEXT=$(printf "%03d" $((10#$NEXT + 1)))
  FEATURE_DIR="$SPECS_DIR/${NEXT}-${SLUG}"
  BRANCH="feature/${NEXT}-${SLUG}"
done

# If the constitution opted into worktrees, every new spec lands in its own
# .worktrees/<NNN-slug> checkout so parallel agents never share a working tree.
# Otherwise fall back to the legacy single-tree flow (checkout branch in place).
CONSTITUTION=".behavior-kit/memory/constitution.md"
WORKTREES_ENABLED=false
if [[ -f "$CONSTITUTION" ]] && grep -qE '^Worktrees:[[:space:]]*enabled[[:space:]]*$' "$CONSTITUTION"; then
  WORKTREES_ENABLED=true
fi

if $WORKTREES_ENABLED; then
  WORKTREE_PATH=".worktrees/${NEXT}-${SLUG}"
  if [[ -e "$WORKTREE_PATH" ]]; then
    echo "Error: worktree path '$WORKTREE_PATH' already exists." >&2
    exit 1
  fi
  mkdir -p .worktrees
  # Branch is created off the current HEAD; agents run their spec/plan/implement
  # phases entirely inside the worktree so their files never collide with main.
  git worktree add -b "$BRANCH" "$WORKTREE_PATH" HEAD >/dev/null
  mkdir -p "$WORKTREE_PATH/$FEATURE_DIR"

  echo "Created branch: $BRANCH"
  echo "Created worktree: $WORKTREE_PATH"
  echo "Created directory: $WORKTREE_PATH/$FEATURE_DIR"
  echo ""
  echo "Next: cd $WORKTREE_PATH  (all subsequent /bk.* commands run from inside the worktree)"
  echo "$WORKTREE_PATH/$FEATURE_DIR"
else
  git checkout -b "$BRANCH"
  mkdir -p "$FEATURE_DIR"

  echo "Created branch: $BRANCH"
  echo "Created directory: $FEATURE_DIR"
  echo "$FEATURE_DIR"
fi
