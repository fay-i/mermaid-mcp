# Quickstart: Session-Based Artifact Caching

**Feature**: 007-session-artifact-cache

## Overview

This feature adds disk-based artifact caching to the MCP server. Rendered diagrams are stored on disk and referenced by ID, reducing response payload sizes by ~90%.

## Key Changes

### New Tool: `fetch_artifact`

Retrieves cached artifacts by ID:

```json
// Input
{
  "artifact_id": "550e8400-e29b-41d4-a716-446655440000",
  "encoding": "base64"  // or "utf8" for SVG
}

// Output
{
  "ok": true,
  "content": "<base64 or utf8 content>",
  "content_type": "image/svg+xml",
  "size_bytes": 12345,
  "encoding": "base64"
}
```

### Modified Tools: `mermaid_to_svg`, `mermaid_to_pdf`

Now return artifact references instead of inline content:

```json
// Before (inline mode)
{
  "ok": true,
  "request_id": "...",
  "svg": "<svg>...</svg>",
  "mode": "inline"
}

// After (cached mode)
{
  "ok": true,
  "request_id": "...",
  "artifact": {
    "artifact_id": "550e8400-...",
    "uri": "file:///tmp/mermaid-mcp-cache/session123/artifact.svg",
    "content_type": "image/svg+xml",
    "size_bytes": 12345
  },
  "mode": "cached"
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MERMAID_CACHE_ENABLED` | `true` | Enable/disable caching |
| `MERMAID_CACHE_DIR` | `$TMPDIR/mermaid-mcp-cache` | Cache directory |
| `MERMAID_CACHE_QUOTA_GB` | `10` | Max cache size in GB |

## Usage Pattern

1. **Render a diagram**:
   ```
   mermaid_to_svg({ code: "graph TD; A-->B" })
   → Returns { artifact: { artifact_id: "abc123", ... } }
   ```

2. **Retrieve when needed**:
   ```
   fetch_artifact({ artifact_id: "abc123" })
   → Returns full SVG content
   ```

3. **Artifacts auto-cleanup on session disconnect**

## Error Handling

| Error Code | Meaning | Action |
|------------|---------|--------|
| `ARTIFACT_NOT_FOUND` | Artifact doesn't exist | Re-render the diagram |
| `SESSION_MISMATCH` | Wrong session | Use artifact from current session |
| `CACHE_UNAVAILABLE` | Cache disabled/failed | Response falls back to inline mode |

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Full quality gate
npm run quality
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  mermaid_to_*   │────▶│  CacheManager   │
└─────────────────┘     └────────┬────────┘
                                 │
┌─────────────────┐              ▼
│ fetch_artifact  │────▶  File System Cache
└─────────────────┘     ┌─────────────────┐
                        │ <session-id>/   │
                        │   <artifact>.svg│
                        └─────────────────┘
```

## Implementation Order

1. **US1**: Render with cached output (modify `mermaid_to_svg`, `mermaid_to_pdf`)
2. **US2**: Fetch cached artifact (new `fetch_artifact` tool)
3. **US3**: Session isolation (validate session ownership)
4. **US4**: Session cleanup (cleanup on disconnect/timeout)
5. **US5**: Quota management (LRU eviction)
6. **US6**: Graceful degradation (inline fallback)
