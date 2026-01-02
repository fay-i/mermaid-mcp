# Session-Based Artifact Caching — Tasks Prompt

Generate tasks for implementing session-based artifact caching.

## Phase 1: Research & Foundation

- Research MCP SDK session/connection lifecycle APIs
- Research supergateway session signaling capabilities
- Design cache directory structure and naming conventions
- Define artifact reference schema (artifact_id, uri format)
- Create spec document with findings

## Phase 2: Cache Infrastructure

- Implement CacheManager class with session isolation
- Implement quota tracking and LRU eviction (10GB limit)
- Implement session cleanup on disconnect
- Add cache directory configuration (env var: MERMAID_CACHE_DIR)
- Add quota configuration (env var: MERMAID_CACHE_QUOTA_GB)
- Unit tests for CacheManager

## Phase 3: Tool Modifications

- Modify mermaid_to_svg to write to cache, return artifact reference
- Modify mermaid_to_pdf to write to cache, return artifact reference
- Implement fetch_artifact tool schema
- Implement fetch_artifact tool handler
- Add backward compatibility flag for inline mode if needed
- Update existing tool tests

## Phase 4: Session Lifecycle

- Implement session tracking (creation, active, cleanup)
- Hook into MCP connection events or supergateway signals
- Implement graceful cleanup on server shutdown
- Handle orphaned sessions (crash recovery)
- Session lifecycle tests

## Phase 5: Polish & Integration

- Integration tests for cache lifecycle
- Quota limit tests
- Session isolation tests (can't fetch other session's artifacts)
- Update MCP Inspector integration tests
- Update documentation and quickstart
- Update Dockerfile if cache dir needs special handling

## Task Dependencies

```
Phase 1 (Research)
    │
    ▼
Phase 2 (Cache Infrastructure)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3 (Tools)    Phase 4 (Sessions)
    │                  │
    └────────┬─────────┘
             ▼
      Phase 5 (Polish)
```

## Acceptance Tests

Each phase should include tests verifying:
- Phase 2: Cache writes, reads, eviction, cleanup
- Phase 3: Tools return artifact refs, fetch_artifact works
- Phase 4: Session start/end detected, cleanup triggered
- Phase 5: End-to-end flow, quota enforcement, isolation
