# Data Model: Session-Based Artifact Caching

**Feature**: 007-session-artifact-cache
**Date**: 2026-01-02

## Entities

### 1. Artifact

Represents a rendered diagram output stored on disk.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | `string` | Unique identifier (UUID v4) | Required; format: UUID |
| `sessionId` | `string` | Owning session identifier | Required; format: UUID |
| `contentType` | `string` | MIME type of artifact | Required; enum: `image/svg+xml`, `application/pdf` |
| `extension` | `string` | File extension | Required; enum: `svg`, `pdf` |
| `sizeBytes` | `number` | File size in bytes | Required; positive integer |
| `createdAt` | `number` | Unix timestamp (ms) of creation | Required; positive integer |
| `lastAccessedAt` | `number` | Unix timestamp (ms) of last access | Required; positive integer |
| `path` | `string` | Absolute file system path | Required; valid file path |
| `uri` | `string` | File URI for artifact | Required; format: `file://...` |

**Validation Rules**:
- `id` must be a valid UUID v4
- `sessionId` must be a valid UUID v4
- `sizeBytes` must be > 0
- `lastAccessedAt` >= `createdAt`
- `path` must exist on disk (for valid artifacts)

**State Transitions**:
```
Created → Active → Evicted
              ↓
           Deleted (session cleanup)
```

---

### 2. Session

Represents an active MCP client connection with associated artifacts.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | `string` | Session identifier from MCP SDK | Required; format: UUID |
| `createdAt` | `number` | Unix timestamp (ms) of first activity | Required; positive integer |
| `lastActivityAt` | `number` | Unix timestamp (ms) of last activity | Required; positive integer |
| `artifactCount` | `number` | Number of artifacts in session | Required; non-negative integer |
| `totalSizeBytes` | `number` | Total size of all session artifacts | Required; non-negative integer |
| `directoryPath` | `string` | Absolute path to session directory | Required; valid directory path |

**Validation Rules**:
- `id` must match MCP SDK's `RequestHandlerExtra.sessionId` format
- `artifactCount` must equal actual artifact count in session
- `totalSizeBytes` must equal sum of all artifact sizes
- `lastActivityAt` >= `createdAt`

**State Transitions**:
```
Created (first request) → Active (subsequent requests) → Stale (timeout) → Deleted
```

---

### 3. CacheConfig

Configuration for the cache system.

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `rootDirectory` | `string` | Cache root directory | `$TMPDIR/mermaid-mcp-cache` |
| `quotaBytes` | `number` | Maximum cache size in bytes | `10737418240` (10GB) |
| `enabled` | `boolean` | Whether caching is enabled | `true` |
| `sessionTimeoutMs` | `number` | Session inactivity timeout | `3600000` (1 hour) |
| `cleanupIntervalMs` | `number` | Orphan cleanup interval | `300000` (5 min) |

**Validation Rules**:
- `rootDirectory` must be a writable path
- `quotaBytes` must be > 0
- `sessionTimeoutMs` must be > 0
- `cleanupIntervalMs` must be > 0

---

### 4. CacheState

Runtime state of the cache system.

| Field | Type | Description |
|-------|------|-------------|
| `totalSizeBytes` | `number` | Current total cache size |
| `sessionCount` | `number` | Number of active sessions |
| `artifactCount` | `number` | Total number of cached artifacts |
| `isHealthy` | `boolean` | Whether cache is operational |
| `lastCleanupAt` | `number \| null` | Timestamp of last cleanup run |

---

### 5. ArtifactReference

Lightweight reference returned in tool responses instead of inline content.

| Field | Type | Description |
|-------|------|-------------|
| `artifact_id` | `string` | Artifact UUID for retrieval |
| `uri` | `string` | File URI to artifact |
| `content_type` | `string` | MIME type |
| `size_bytes` | `number` | File size |

**Example**:
```json
{
  "artifact_id": "550e8400-e29b-41d4-a716-446655440000",
  "uri": "file:///tmp/mermaid-mcp-cache/abc123/550e8400-e29b-41d4-a716-446655440000.svg",
  "content_type": "image/svg+xml",
  "size_bytes": 12345
}
```

---

## Relationships

```
┌─────────────┐       owns        ┌────────────┐
│   Session   │ ───────────────── │  Artifact  │
│             │  1            *   │            │
└─────────────┘                   └────────────┘
       │
       │ tracked by
       ▼
┌─────────────┐
│ CacheState  │
└─────────────┘
       │
       │ configured by
       ▼
┌─────────────┐
│ CacheConfig │
└─────────────┘
```

**Relationship Rules**:
- A Session owns zero or more Artifacts
- An Artifact belongs to exactly one Session
- CacheState tracks all Sessions and Artifacts
- CacheConfig defines behavior for CacheState

---

## In-Memory Data Structures

### Session Metadata Map

```typescript
type SessionMetadata = Map<string, {
  createdAt: number;
  lastActivityAt: number;
  artifacts: Map<string, ArtifactMetadata>;
  totalSizeBytes: number;
}>;

type ArtifactMetadata = {
  id: string;
  contentType: string;
  extension: string;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  path: string;
};
```

### Global LRU Index

For efficient eviction, maintain a sorted index:

```typescript
type LRUEntry = {
  artifactId: string;
  sessionId: string;
  lastAccessedAt: number;
  sizeBytes: number;
};

// Sorted by lastAccessedAt ascending (oldest first)
type LRUIndex = LRUEntry[];
```

---

## File System Layout

```text
$TMPDIR/mermaid-mcp-cache/
├── <session-id-1>/
│   ├── <artifact-id-1>.<ext>
│   ├── <artifact-id-2>.<ext>
│   └── ...
├── <session-id-2>/
│   └── ...
└── ...
```

**Naming Conventions**:
- Session directories: UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Artifact files: `<uuid>.<ext>` (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.svg`)

---

## Error Codes

| Code | HTTP Equiv | Description |
|------|------------|-------------|
| `ARTIFACT_NOT_FOUND` | 404 | Artifact ID does not exist |
| `SESSION_MISMATCH` | 403 | Artifact belongs to different session |
| `CACHE_UNAVAILABLE` | 503 | Cache is disabled or unhealthy |
| `CACHE_WRITE_FAILED` | 500 | Failed to write artifact to disk |
| `QUOTA_EXCEEDED` | 507 | Cache quota exceeded, eviction failed |
| `INVALID_ARTIFACT_ID` | 400 | Artifact ID is malformed |

---

## TypeScript Type Definitions

```typescript
// Artifact reference returned by render tools
interface ArtifactRef {
  artifact_id: string;
  uri: string;
  content_type: 'image/svg+xml' | 'application/pdf';
  size_bytes: number;
}

// Full artifact metadata (internal)
interface Artifact {
  id: string;
  sessionId: string;
  contentType: 'image/svg+xml' | 'application/pdf';
  extension: 'svg' | 'pdf';
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  path: string;
  uri: string;
}

// Session metadata (internal)
interface SessionMeta {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  artifactCount: number;
  totalSizeBytes: number;
  directoryPath: string;
}

// Cache configuration
interface CacheConfig {
  rootDirectory: string;
  quotaBytes: number;
  enabled: boolean;
  sessionTimeoutMs: number;
  cleanupIntervalMs: number;
}

// Cache runtime state
interface CacheState {
  totalSizeBytes: number;
  sessionCount: number;
  artifactCount: number;
  isHealthy: boolean;
  lastCleanupAt: number | null;
}

// Fetch artifact input
interface FetchArtifactInput {
  artifact_id: string;
  encoding?: 'base64' | 'utf8';
}

// Fetch artifact output (success)
interface FetchArtifactOutput {
  ok: true;
  content: string;
  content_type: string;
  size_bytes: number;
  encoding: 'base64' | 'utf8';
}

// Cache error
interface CacheError {
  code: 'ARTIFACT_NOT_FOUND' | 'SESSION_MISMATCH' | 'CACHE_UNAVAILABLE' |
        'CACHE_WRITE_FAILED' | 'QUOTA_EXCEEDED' | 'INVALID_ARTIFACT_ID';
  message: string;
  details?: Record<string, unknown>;
}
```
