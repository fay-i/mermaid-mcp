# Feature Specification: Session-Based Artifact Caching

**Feature Branch**: `007-session-artifact-cache`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "Add disk-based artifact caching to the MCP server with session lifecycle management."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render Diagram with Cached Output (Priority: P1)

An AI agent uses the MCP server to render a Mermaid diagram. Instead of receiving a large base64-encoded response inline, the server writes the artifact to disk and returns a lightweight reference. This reduces response payload size and enables artifact reuse.

**Why this priority**: Core value proposition - without caching to disk and returning references, the feature provides no benefit. This is the fundamental behavior change.

**Independent Test**: Can be fully tested by calling `mermaid_to_svg` and verifying the response contains an artifact reference (URI and ID) instead of inline base64 content, and the file exists on disk.

**Acceptance Scenarios**:

1. **Given** a valid Mermaid diagram, **When** `mermaid_to_svg` is called, **Then** the response includes `artifact_id`, `uri`, `content_type`, and `size_bytes` instead of inline content
2. **Given** a valid Mermaid diagram, **When** `mermaid_to_pdf` is called, **Then** the response includes `artifact_id`, `uri`, `content_type`, and `size_bytes` instead of inline content
3. **Given** a successful render, **When** checking the cache directory, **Then** the artifact file exists at the expected path

---

### User Story 2 - Fetch Cached Artifact (Priority: P1)

An AI agent retrieves a previously rendered artifact using its artifact ID. The `fetch_artifact` tool returns the full content, allowing the agent to access the rendered diagram when needed.

**Why this priority**: Essential companion to caching - without retrieval capability, cached artifacts are unusable. This completes the core workflow.

**Independent Test**: Can be fully tested by rendering a diagram, then calling `fetch_artifact` with the returned artifact ID and verifying the content matches the original render.

**Acceptance Scenarios**:

1. **Given** a cached artifact, **When** `fetch_artifact` is called with the artifact ID, **Then** the full content is returned with correct content type and size
2. **Given** an artifact ID, **When** `fetch_artifact` is called with `encoding: "base64"`, **Then** the content is base64-encoded
3. **Given** an artifact ID, **When** `fetch_artifact` is called with `encoding: "utf8"`, **Then** the content is returned as UTF-8 text (for SVG)

---

### User Story 3 - Session Isolation (Priority: P2)

Artifacts are scoped to the session that created them. One session cannot access another session's artifacts, ensuring security and privacy between different AI agent sessions.

**Why this priority**: Security requirement - without isolation, artifacts from different sessions could be accessed inappropriately. Important for multi-tenant deployments.

**Independent Test**: Can be tested by creating artifacts in session A, then attempting to fetch them from session B and verifying access is denied.

**Acceptance Scenarios**:

1. **Given** an artifact created in session A, **When** session B attempts to fetch it, **Then** a `SESSION_MISMATCH` error is returned
2. **Given** an artifact URI, **When** the session ID in the URI doesn't match the requesting session, **Then** access is denied

---

### User Story 4 - Session Cleanup (Priority: P2)

When a session disconnects, all artifacts belonging to that session are automatically cleaned up. This prevents disk space accumulation from abandoned sessions.

**Why this priority**: Resource management - without cleanup, disk usage grows unboundedly. Essential for long-running server deployments.

**Independent Test**: Can be tested by creating artifacts in a session, disconnecting the session, and verifying the artifacts are removed from disk.

**Acceptance Scenarios**:

1. **Given** a session with cached artifacts, **When** the session disconnects, **Then** all artifacts for that session are deleted from disk
2. **Given** session cleanup occurs, **When** checking the cache directory, **Then** no files or directories remain for that session

---

### User Story 5 - Storage Quota Management (Priority: P3)

The cache enforces a configurable storage quota (default 10GB). When the quota is approached, artifacts are evicted using LRU (Least Recently Used) policy based on last access time.

**Why this priority**: Operational safety net - prevents runaway disk usage. Lower priority because session cleanup handles most cases; quota is a backstop for edge cases.

**Independent Test**: Can be tested by filling the cache to quota, then adding a new artifact and verifying the least recently accessed artifact was evicted.

**Acceptance Scenarios**:

1. **Given** the cache is near quota, **When** a new artifact is written, **Then** the least recently used artifact(s) are evicted to make room
2. **Given** the cache exceeds quota, **When** eviction occurs, **Then** enough artifacts are removed to bring usage below quota

---

### User Story 6 - Graceful Degradation (Priority: P3)

When the cache is unavailable (directory not writable, disk full, etc.), the server falls back to inline responses rather than failing completely.

**Why this priority**: Resilience - ensures the server remains functional even when caching fails. Lower priority because it's an edge case, but important for production reliability.

**Independent Test**: Can be tested by making the cache directory unwritable, then rendering a diagram and verifying inline content is returned.

**Acceptance Scenarios**:

1. **Given** the cache directory is not writable, **When** `mermaid_to_svg` is called, **Then** inline base64 content is returned (backward compatibility)
2. **Given** a cache write failure, **When** rendering completes, **Then** the response indicates inline mode with appropriate warning

---

### Edge Cases

- What happens when an artifact is fetched after session timeout but before cleanup? Return `ARTIFACT_NOT_FOUND`.
- How does the system handle concurrent writes to the same artifact ID? Each render generates a unique UUID, so collisions don't occur.
- What happens when disk is completely full? Return `CACHE_WRITE_FAILED` and fall back to inline mode.
- What happens when fetch is called with a malformed artifact ID? Return validation error with details.
- What happens when the cache directory is deleted while server is running? Detect on next write, recreate directory or fall back to inline mode.
- What happens on server restart? Cache directory is cleared on startup to remove orphaned artifacts from previous sessions.

## Clarifications

### Session 2026-01-02

- Q: How is session ID obtained for artifact isolation? → A: Use MCP SDK session/connection identifier from SSE transport
- Q: Where is the default cache directory location? → A: OS temp directory with subdirectory (`$TMPDIR/mermaid-mcp-cache`)
- Q: What format should artifact URIs use? → A: File URI scheme (`file://<cache_dir>/<session_id>/<artifact_id>.<ext>`)
- Q: What eviction strategy for quota management? → A: LRU by last access time (standard cache behavior)
- Q: What happens to cached artifacts on server restart? → A: Clear entire cache directory on server startup

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST write rendered artifacts (SVG, PDF) to a disk cache instead of returning inline
- **FR-002**: System MUST return artifact references (ID, URI, content type, size) instead of base64-encoded content
- **FR-003**: System MUST provide a `fetch_artifact` tool that retrieves cached content by artifact ID
- **FR-004**: System MUST associate each cached artifact with the session that created it
- **FR-005**: System MUST prevent access to artifacts from sessions other than the creating session
- **FR-006**: System MUST clean up all artifacts when a session disconnects
- **FR-007**: System MUST enforce a configurable storage quota (default 10GB) for the cache
- **FR-008**: System MUST use LRU eviction by last access time when storage quota is approached
- **FR-009**: System MUST fall back to inline responses when caching is unavailable
- **FR-010**: System MUST support configuration of cache directory, quota size, and enable/disable caching
- **FR-011**: System MUST generate unique artifact IDs (UUIDs) for each rendered artifact
- **FR-012**: System MUST return appropriate error codes for cache-related failures (`ARTIFACT_NOT_FOUND`, `SESSION_MISMATCH`, `CACHE_UNAVAILABLE`, `QUOTA_EXCEEDED`, `CACHE_WRITE_FAILED`)
- **FR-013**: System MUST clear the cache directory on server startup to remove orphaned artifacts

### Key Entities

- **Session**: Represents an active SSE connection; ID obtained from MCP SDK session/connection identifier; owns zero or more artifacts; lifecycle tied to SSE connection
- **Artifact**: A rendered diagram output; has unique ID (UUID), content type, file size, creation time, last access time; stored at `<cache_dir>/<session_id>/<artifact_id>.<ext>`; URI format: `file://<full_path>`
- **Cache**: The storage system; root directory defaults to `$TMPDIR/mermaid-mcp-cache`; has configurable quota, usage tracking; manages artifact lifecycle and eviction

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Response payload size for diagram renders is reduced by at least 90% (reference vs inline content)
- **SC-002**: Artifacts can be retrieved within 100ms of creation
- **SC-003**: Session cleanup completes within 5 seconds of disconnect
- **SC-004**: System maintains operation when cache is unavailable, with successful fallback to inline responses
- **SC-005**: Storage usage stays within configured quota under sustained load
- **SC-006**: No artifacts from one session are accessible by another session (100% isolation)
