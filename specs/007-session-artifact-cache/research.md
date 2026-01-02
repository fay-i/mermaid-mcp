# Research: Session-Based Artifact Caching

**Feature**: 007-session-artifact-cache
**Date**: 2026-01-02

## Research Summary

This document resolves all technical unknowns identified in the plan prompt for session-based artifact caching.

---

## Decision 1: Session Detection Mechanism

**Question**: How do we know when a session starts/ends in a stdio-based MCP server fronted by supergateway?

**Decision**: Use MCP SDK's `RequestHandlerExtra.sessionId` passed to tool handlers.

**Rationale**:
- The MCP SDK automatically propagates `sessionId` from the transport layer to every request handler via the `RequestHandlerExtra` object
- For SSE/Streamable HTTP transports (what supergateway uses), session ID is a UUID generated at transport initialization
- For stdio transport, `sessionId` is `undefined` - this enables graceful fallback to inline responses
- No parsing of MCP protocol messages required; the SDK handles session tracking internally

**Alternatives Considered**:
1. **Parse MCP initialize/shutdown messages** - Rejected: Unnecessary complexity; SDK already provides session ID
2. **Supergateway environment variable** - Rejected: Supergateway doesn't inject session ID into child process environment; would require forking/modifying supergateway
3. **Custom session header** - Rejected: Would require client-side changes; SDK approach is transparent

**Implementation**:
```typescript
server.tool("mermaid_to_svg", schema, async (params, extra) => {
  const sessionId = extra.sessionId;  // Available from MCP SDK
  if (sessionId) {
    // Use cache with session isolation
  } else {
    // Fallback to inline response (stdio transport)
  }
});
```

---

## Decision 2: Session Lifecycle Events

**Question**: How do we clean up artifacts when a session disconnects?

**Decision**: Use transport-level `onclose` callback combined with periodic orphan cleanup.

**Rationale**:
- The MCP SDK's `Transport` interface provides an `onclose` callback that fires when the connection closes
- For Streamable HTTP transport, `onsessionclosed(sessionId)` callback provides the session ID directly
- However, our server uses stdio internally - we don't directly control the transport
- Supergateway manages the SSE-to-stdio bridge, so we need a hybrid approach:
  1. Track session activity via last-access timestamps
  2. Clean up on server shutdown (process exit)
  3. Periodic cleanup for sessions with no recent activity (orphan detection)

**Alternatives Considered**:
1. **Immediate cleanup on disconnect** - Partial: We can't reliably detect disconnect in stdio mode
2. **Rely solely on server shutdown** - Rejected: Would leave orphans during long-running deployments
3. **Modify supergateway** - Rejected: Introduces external dependency; periodic cleanup is sufficient

**Implementation**:
```typescript
// Track last access per session
sessionMetadata.set(sessionId, { lastAccess: Date.now(), artifacts: [] });

// Periodic cleanup (e.g., every 5 minutes)
setInterval(() => {
  const staleThreshold = Date.now() - SESSION_TIMEOUT_MS;
  for (const [sessionId, meta] of sessionMetadata) {
    if (meta.lastAccess < staleThreshold) {
      cleanupSession(sessionId);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Cleanup on server shutdown
process.on('SIGTERM', () => cleanupAllSessions());
process.on('SIGINT', () => cleanupAllSessions());
```

---

## Decision 3: Cache Directory Structure

**Question**: How should we organize the cache on disk?

**Decision**: Use `<cache_root>/<session_id>/<artifact_id>.<ext>` structure.

**Rationale**:
- Session-level directories enable atomic cleanup (delete entire directory on session end)
- Flat artifact files within session directory (no nested subdirectories) simplify LRU tracking
- Extension preserved from content type for debugging/inspection
- Metadata stored in memory (Map) with optional persistence for crash recovery

**Cache Layout**:
```text
$TMPDIR/mermaid-mcp-cache/
├── session-abc123/
│   ├── artifact-001.svg
│   ├── artifact-002.pdf
│   └── artifact-003.svg
├── session-def456/
│   └── artifact-001.svg
└── .metadata.json           # Optional: persisted metadata for crash recovery
```

**Alternatives Considered**:
1. **Flat structure with session prefix** (`cache/<session>_<artifact>.ext`) - Rejected: Harder to clean up entire session atomically
2. **Database for metadata** (SQLite) - Rejected: Over-engineering for simple use case; in-memory Map sufficient
3. **Hash-based directory sharding** - Rejected: Unnecessary for expected scale; adds complexity

---

## Decision 4: Artifact URI Format

**Question**: What format should artifact URIs use?

**Decision**: Use `file://` URI scheme with absolute path.

**Rationale**:
- File URIs are standard and self-documenting
- Absolute paths enable direct file system access
- Compatible with MCP resource URIs if future expansion needed
- Client can parse and validate URI structure

**URI Format**: `file://<absolute_path_to_artifact>`

**Example**: `file:///tmp/mermaid-mcp-cache/session-abc123/artifact-001.svg`

**Alternatives Considered**:
1. **Custom scheme** (`mermaid://session/artifact`) - Rejected: Requires custom parsing; file:// is standard
2. **Relative paths** - Rejected: Ambiguous; absolute paths are explicit
3. **HTTP URLs** - Rejected: Would require HTTP server; file:// is simpler for local cache

---

## Decision 5: Quota Management Strategy

**Question**: How do we enforce the 10GB limit?

**Decision**: Global LRU eviction based on last access time, with per-session size tracking.

**Rationale**:
- LRU is industry-standard for cache eviction
- Last access time (not creation time) ensures frequently-used artifacts persist
- Global quota prevents any single session from monopolizing storage
- Per-session tracking enables reporting and potential future per-session limits

**Algorithm**:
1. Before writing new artifact, check total cache size
2. If `currentSize + newArtifactSize > quota`:
   - Sort all artifacts by last access time (ascending)
   - Evict oldest artifacts until `currentSize + newArtifactSize <= quota * 0.9` (evict to 90% to avoid repeated evictions)
3. Write new artifact and update metadata

**Alternatives Considered**:
1. **Per-session quota** - Rejected: Unfair distribution; one large diagram shouldn't block small ones
2. **FIFO eviction** - Rejected: Doesn't account for usage patterns; LRU is more effective
3. **Size-based eviction (largest first)** - Rejected: Would preferentially evict large artifacts even if recently used

---

## Decision 6: Graceful Degradation

**Question**: What happens when the cache is unavailable?

**Decision**: Fall back to inline base64 responses with warning.

**Rationale**:
- Maintains backward compatibility with existing clients
- Ensures server remains functional under all conditions
- Warning in response informs client of degraded mode

**Degradation Triggers**:
1. `sessionId` is `undefined` (stdio transport)
2. Cache directory not writable
3. Disk full (cache write fails)
4. Environment variable `MERMAID_CACHE_ENABLED=false`

**Response Structure in Degraded Mode**:
```json
{
  "ok": true,
  "request_id": "...",
  "svg": "<svg>...</svg>",
  "warnings": [{ "code": "CACHE_UNAVAILABLE", "message": "..." }],
  "mode": "inline"
}
```

---

## Decision 7: Configuration Options

**Question**: What configuration options should be exposed?

**Decision**: Environment variables for all configurable aspects.

| Variable | Default | Description |
|----------|---------|-------------|
| `MERMAID_CACHE_DIR` | `$TMPDIR/mermaid-mcp-cache` | Cache root directory |
| `MERMAID_CACHE_QUOTA_GB` | `10` | Maximum cache size in GB |
| `MERMAID_CACHE_ENABLED` | `true` | Enable/disable caching |
| `MERMAID_SESSION_TIMEOUT_MS` | `3600000` (1 hour) | Session inactivity timeout |
| `MERMAID_CACHE_CLEANUP_INTERVAL_MS` | `300000` (5 min) | Orphan cleanup interval |

**Rationale**:
- Environment variables are standard for containerized deployments
- No config files required; 12-factor app compliance
- Sensible defaults for zero-config startup

---

## Decision 8: Startup Behavior

**Question**: What happens to cached artifacts on server restart?

**Decision**: Clear entire cache directory on startup.

**Rationale**:
- Previous sessions are invalid after restart (no session continuity)
- Orphaned artifacts from crashes are cleaned up
- Ensures consistent state on startup
- Simple implementation (rm -rf equivalent)

**Alternative Considered**:
- **Preserve cache across restarts** - Rejected: Would require session ID persistence and validation; complexity not justified

---

## Technology Best Practices

### Node.js File System Operations

**Best Practices Applied**:
1. Use `fs/promises` API for async operations (no callback hell)
2. Use `fs.mkdir({ recursive: true })` for directory creation
3. Use `fs.rm({ recursive: true, force: true })` for directory deletion
4. Handle `ENOENT` errors gracefully (file/directory not found)
5. Use atomic writes (write to temp file, then rename) for crash safety

### LRU Cache Implementation

**Best Practices Applied**:
1. Use `Map` for O(1) access and insertion-order iteration
2. Update access time on every read (fetch_artifact)
3. Batch eviction to avoid repeated small evictions
4. Track size in bytes, not file count

### MCP SDK Integration

**Best Practices Applied**:
1. Access `sessionId` via `RequestHandlerExtra` in tool handlers
2. Don't assume `sessionId` is always present (stdio fallback)
3. Use existing tool registration pattern from codebase
4. Maintain existing error code conventions

---

## Open Questions (None)

All technical unknowns have been resolved. No blockers for Phase 1 design.
