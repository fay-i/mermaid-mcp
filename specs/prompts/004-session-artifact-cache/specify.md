# Session-Based Artifact Caching — Specify Prompt

Feature: Session-Based Artifact Caching

Add disk-based artifact caching to the MCP server with session lifecycle management.

## Problem

Currently, mermaid_to_svg and mermaid_to_pdf return large base64-encoded content directly in responses. This is inefficient for large diagrams and doesn't allow for artifact reuse within a session.

## Solution

1. Write rendered artifacts (SVG, PDF) to a disk cache instead of returning inline
2. Return a reference/URI to the cached artifact
3. Provide a new `fetch_artifact` tool to retrieve cached content
4. Associate cache with SSE session - when session closes, clear its cache
5. Allocate 10GB storage quota for the cache

## Key Behaviors

- Each SSE connection gets a unique session ID
- Artifacts stored at: `<cache_dir>/<session_id>/<artifact_id>.<ext>`
- Existing tools return `{ok: true, artifact_id: "uuid", uri: "artifact://..."}` instead of inline content
- New `fetch_artifact` tool accepts artifact_id, returns content (base64 or streaming)
- Session cleanup triggered on SSE disconnect (supergateway signals this somehow, or we detect it)
- LRU eviction if 10GB quota exceeded
- Graceful handling if cache dir is unavailable

## Constraints

- Must work with supergateway's SSE proxy model
- Session ID must be passed through from supergateway to MCP server
- Cache must survive tool invocations within same session
- No persistence across server restarts (ephemeral cache)

## New Tool: `fetch_artifact`

### Input Schema
```json
{
  "artifact_id": "string (required, UUID of the artifact)",
  "encoding": "string (optional; 'base64' or 'utf8'; default 'base64')"
}
```

### Output Schema (success)
```json
{
  "ok": true,
  "request_id": "uuid",
  "artifact_id": "uuid",
  "content_type": "string (e.g. 'image/svg+xml', 'application/pdf')",
  "size_bytes": "number",
  "content": "string (encoded content)"
}
```

## Modified Tool Responses

### mermaid_to_svg (with caching)
```json
{
  "ok": true,
  "request_id": "uuid",
  "artifact_id": "uuid",
  "content_type": "image/svg+xml",
  "size_bytes": "number",
  "uri": "artifact://<session_id>/<artifact_id>.svg"
}
```

### mermaid_to_pdf (with caching)
```json
{
  "ok": true,
  "request_id": "uuid",
  "artifact_id": "uuid",
  "content_type": "application/pdf",
  "size_bytes": "number",
  "uri": "artifact://<session_id>/<artifact_id>.pdf"
}
```

## Error Codes

- `ARTIFACT_NOT_FOUND`: Artifact ID does not exist or expired
- `SESSION_MISMATCH`: Artifact belongs to different session
- `CACHE_UNAVAILABLE`: Cache directory not accessible
- `QUOTA_EXCEEDED`: 10GB storage limit reached
- `CACHE_WRITE_FAILED`: Failed to write artifact to disk

## Configuration

- `MERMAID_CACHE_DIR`: Cache directory path (default: system temp dir)
- `MERMAID_CACHE_QUOTA_GB`: Storage quota in GB (default: 10)
- `MERMAID_CACHE_ENABLED`: Enable/disable caching (default: true)

## Acceptance Criteria

1. Artifacts written to disk instead of returned inline
2. fetch_artifact retrieves correct content by ID
3. Session isolation enforced (can't access other session's artifacts)
4. Cache cleared when session disconnects
5. LRU eviction when quota exceeded
6. Graceful degradation if cache unavailable
7. Backward compatibility mode for inline responses
