# Contributing to mermaid-mcp

Thanks for your interest in improving **mermaid-mcp**! It's a Node.js / TypeScript
[Model Context Protocol](https://modelcontextprotocol.io/) server that parses Mermaid
diagram source and produces vector artifacts (SVG primary; optional PDF and deck output).

This project follows a strict, behavior-first engineering constitution. Please read this
guide and [`AGENTS.md`](../AGENTS.md) before opening a pull request — the same rules apply
to human and AI contributors.

## Getting started

```bash
git clone https://github.com/fay-i/mermaid-mcp.git
cd mermaid-mcp
npm install
```

Requires **Node.js 24+** (see `engines` in `package.json`). The rendering pipeline uses a
headless Chromium via `@mermaid-js/mermaid-cli` / Puppeteer.

## Quality gate

Run the full gate before every push — there are **no doc-only exceptions**:

```bash
npm run quality
```

This runs, in order: `typecheck` → `lint` → `format:check` → `build` → `test` →
`test:integration`. The individual commands are also available:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # Biome lint
npm run format:check   # Biome format check
npm run build          # tsc
npm run test           # Vitest unit/behavior tests
npm run test:integration  # MCP Inspector end-to-end tests
```

### Clean Slate Protocol

Before every `git push`, verify from a clean slate so local results match CI:

```bash
npm run clean                       # remove build artifacts
rm -rf node_modules && npm install  # fresh dependency install
npm run quality                     # run all checks
```

## Test-Driven Development by behavior

No implementation code without a failing test first. Tests must assert **observable
behavior**, never internal structure.

The cycle: **problem statement → failing test → minimal code → pass → refactor.**

Every MCP tool change must keep its behavior tests covering: valid input → expected
output, invalid input → documented error, renderer failure → graceful degradation,
timeout → cleanup and error, and resource cleanup → no leaks. Output must be deterministic
(same input → same output).

## No bypasses

Never suppress a failing check. The following are not allowed:

- `test.skip()`, `it.skip()`, `describe.skip()`
- `// @ts-ignore`, `// @ts-expect-error` (without an immediate fix)
- `// eslint-disable` / `// biome-ignore`
- `// prettier-ignore`
- `continue-on-error: true` in CI

If a rule is genuinely wrong, fix it globally rather than suppressing it locally.

## Branch naming

Work happens off `main`, and PRs target `main`. Use one of:

- **Features:** `feature/NNN-slug` (e.g. `feature/012-deck-export`).
- **One-off changes:** a conventional session tag — one of `fix/`, `chore/`, `refactor/`,
  `docs/`, `test/`, `ci/`, `build/`, `perf/`, `style/`, `revert/` — followed by a slug
  (e.g. `docs/community-standards`). Never use `feat/`.

## Commit messages

Write a concise, single-line subject describing the change. Keep PRs atomic — one concern
per PR — and prefer separate PRs for foundational setup, each user story, and polish.

## Pull requests

1. Branch from `main` using the naming convention above.
2. Make your change, writing the failing test(s) first.
3. Run the **Clean Slate Protocol** and confirm `npm run quality` passes.
4. Update `README.md` / docs if you've changed user-facing behavior.
5. Open a PR against `main` and fill out the template. Per the PR Description Protocol,
   include task references, link issues (`Closes #XX`), and confirm tests were written
   first and failed before implementation.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). The full
governance rules live in [`AGENTS.md`](../AGENTS.md) and
[`.specify/memory/constitution.md`](../.specify/memory/constitution.md).
