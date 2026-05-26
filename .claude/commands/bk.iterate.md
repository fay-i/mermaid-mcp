---
description: "Address PR review feedback one comment at a time"
---

# /bk.iterate — Address PR Review Feedback

You are addressing PR review feedback one comment at a time. Each actionable comment becomes a code change with its own commit. Re-run this command for each review round.

## Gate

Before anything else, run `.behavior-kit/scripts/check-prereqs.sh iterate`. If it fails, stop and relay its error message to the user.

Then verify an open PR exists for the current branch:

```bash
gh pr view --json number,state --jq '{number, state}'
```

- If `gh` is not installed or not authenticated, stop with: "Install and authenticate the GitHub CLI: https://cli.github.com"
- If no PR exists, stop with: "No PR found for this branch. Push and create a PR first."
- If the PR state is not `OPEN`, stop with: "This PR is already merged or closed. /bk.iterate only works on open PRs."

## Instructions

1. Read the constitution at `.behavior-kit/memory/constitution.md`
2. Read the spec and behaviors for the current feature in `specs/NNN-feature-name/`
3. Get the PR number:
   ```bash
   gh pr view --json number --jq '.number'
   ```
4. Determine the repo owner/name:
   ```bash
   gh repo view --json nameWithOwner --jq '.nameWithOwner'
   ```
5. Fetch all review feedback:
   - Inline review comments: `gh api repos/{owner}/{repo}/pulls/{pr}/comments`
   - PR-level comments: `gh pr view {pr} --json comments --jq '.comments'`
   - Review summaries: `gh api repos/{owner}/{repo}/pulls/{pr}/reviews`
6. Read existing `specs/NNN-feature-name/review.md` if it exists — skip any comments already addressed in previous rounds
7. Categorize each new comment:
   - **Actionable**: Requires a code change (bug fix, refactor, style change, missing logic)
   - **Question**: Reviewer is asking for clarification — reply only, no code change
   - **Acknowledgment**: Praise, LGTM, agreement — note only, no code change
8. Determine the current round number from `review.md` history (start at 1 if no file exists)
9. For each **actionable** comment (in top-of-diff file order):
   a. Make the code change. If the feedback requires new behavior, write the test first
   b. Ensure all tests pass
   c. Reply on GitHub:
      ```bash
      gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies -f body="Addressed in R{round}.{seq}: [description]"
      ```
   d. Resolve the review thread via GraphQL:
      ```bash
      gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "{threadId}"}) { thread { isResolved } } }'
      ```
   e. Commit: `R{round}.{seq}: [description]`
10. For each **question**: reply with an explanation on GitHub, record in review.md
11. For each **acknowledgment**: record in review.md, no reply needed
12. If two reviewers give conflicting feedback, pause and ask the user which direction to take
13. Update `specs/NNN-feature-name/review.md` using the template at `.behavior-kit/templates/review-template.md`

## Rules
- One comment per commit for actionable items
- Tests must stay passing after every change
- Reply to every actionable and question comment on GitHub
- Never argue with feedback — address it or ask the user for guidance
- Update review.md after each item is addressed
- Commit format: `R{round}.{seq}: [description]` (e.g., `R1.01: Extract validation helper`)
- If feedback would break existing behaviors, follow TDD: update the test first, then the code

## Forbidden
- Batch-addressing multiple comments in one commit
- Ignoring or skipping comments
- Making unrelated code changes
- Force-pushing
- Resolving threads without actually addressing the feedback
- Weakening or removing tests to satisfy feedback

## Output
Updated code with one commit per actionable item, all review threads replied to and resolved, and an up-to-date `review.md` documenting the round
