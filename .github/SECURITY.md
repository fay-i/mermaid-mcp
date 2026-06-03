# Security Policy

## Supported versions

`@fay-i/mermaid-mcp` is distributed from `main` and published to npm. Only the latest
published release (and the current `main`) is supported. Please update to the latest
version before reporting an issue.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected tool or component, and steps to reproduce.

We'll acknowledge the report, investigate, and coordinate a fix and disclosure with you.

Because the server renders **untrusted Mermaid source** through a headless-browser
pipeline (`@mermaid-js/mermaid-cli` / Puppeteer) and writes artifacts to local or remote
storage, reports about diagram-input handling, renderer process execution, resource
exhaustion (timeouts / unbounded output), or anything that could read or write outside the
intended storage paths are especially appreciated.
