# Session-Based Artifact Caching — Plan Prompt

Create an implementation plan for session-based artifact caching.

## Key Architectural Decisions

1. How does supergateway communicate session lifecycle to the MCP server via stdio?
2. Where should the cache directory live? (configurable via env var, default to temp dir)
3. How to track session state in a stdio-based MCP server (sessions are implicit)
4. Schema design for artifact references vs inline content
5. Quota management strategy (LRU eviction, per-session limits vs global)
6. Error handling when cache is full or unavailable

## Context

- The MCP server uses stdio transport internally (supergateway handles SSE)
- We may need to parse MCP protocol messages to detect session boundaries
- Or supergateway may need configuration to signal session events
- The fetch_artifact tool needs to validate artifact ownership (session isolation)

## Research Needed

- How does @modelcontextprotocol/sdk handle session/connection lifecycle?
- Does supergateway expose any session hooks or environment variables?
- What's the MCP protocol's session/connection model?
- How do other MCP servers handle artifact/file caching?

## Design Questions

1. **Session Detection**: How do we know when a session starts/ends?
   - Option A: Supergateway passes session ID via environment variable
   - Option B: Parse MCP initialize/shutdown messages
   - Option C: Use connection-level events from MCP SDK

2. **Cache Structure**: How should we organize the cache?
   - `<cache_root>/<session_id>/<artifact_id>.<ext>`
   - Metadata file per session for tracking?

3. **Quota Management**: How do we enforce the 10GB limit?
   - Global LRU across all sessions
   - Per-session quota with global cap
   - Evict oldest artifacts first vs oldest sessions first

4. **Cleanup Strategy**: When and how do we clean up?
   - On session disconnect (immediate)
   - On server shutdown (all sessions)
   - Periodic cleanup for orphaned files (crash recovery)

5. **Backward Compatibility**: Should we support inline mode?
   - Query parameter: `?inline=true`
   - Config option: `MERMAID_CACHE_ENABLED=false`
   - Per-request option in tool input

## Dependencies

- Existing: `002-mermaid-to-svg`, `003-mermaid-to-pdf`
- May require: supergateway modifications or configuration
