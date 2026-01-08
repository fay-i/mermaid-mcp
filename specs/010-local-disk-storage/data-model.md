# Data Model: Local Disk Storage

**Feature**: 010-local-disk-storage
**Date**: January 6, 2026

## Entities

### StorageBackend (Interface)

Abstract interface representing a storage mechanism for artifacts.

| Field | Type | Description |
|-------|------|-------------|
| — | — | Interface, no direct fields |

**Methods**:
- `store(sessionId, artifactId, content, contentType) → StorageResult`
- `retrieve(sessionId, artifactId) → Buffer`
- `delete(sessionId, artifactId) → void`
- `exists(sessionId, artifactId) → boolean`
- `getType() → 'local' | 's3'`

**Relationships**:
- Implemented by: LocalStorageBackend, S3StorageBackend
- Used by: MCP tools, CDN proxy

### LocalStorageBackend (Class)

Implementation of StorageBackend using Node.js filesystem operations.

| Field | Type | Description |
|-------|------|-------------|
| basePath | string | Container path: `/app/data/artifacts` |
| hostPath | string | Host path from HOST_STORAGE_PATH env |

**State Transitions**: None (stateless operations)

**Validation Rules**:
- basePath must be writable (validated at startup)
- sessionId and artifactId must be valid UUIDs (path traversal prevention)

### S3StorageBackend (Class)

Implementation of StorageBackend using AWS S3 SDK. Wraps existing `S3Storage` class.

| Field | Type | Description |
|-------|------|-------------|
| client | S3Client | AWS SDK client |
| config | S3Config | Endpoint, bucket, credentials |

**State Transitions**: None (stateless operations)

**Validation Rules**:
- All S3 credentials required at construction time
- Bucket must exist and be accessible

### StorageResult (Interface)

Result returned from storage operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| artifact_id | string | Yes | UUID of stored artifact |
| download_url | string | Yes | file:// or https:// URL |
| content_type | string | Yes | MIME type |
| size_bytes | number | Yes | Content size in bytes |
| storage_type | 'local' \| 's3' | Yes | Backend type |
| expires_in_seconds | number | No | S3 presigned URL expiry |
| s3 | S3Location | No | S3-specific metadata |

### StorageConfig (Interface)

Configuration for storage backend selection.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| storageType | 'auto' \| 'local' \| 's3' | No | 'auto' | Backend selection mode |
| localStoragePath | string | No | '/app/data/artifacts' | Container storage path |
| hostStoragePath | string | No | undefined | Host filesystem path for file:// URLs |
| localUrlScheme | 'file' \| 'http' | No | 'file' | URL scheme for local artifacts |
| cdnHost | string | No | 'localhost' | CDN proxy host for http:// URLs |
| cdnPort | number | No | 3001 | CDN proxy port for http:// URLs |
| s3Endpoint | string | Conditional | — | S3/MinIO endpoint |
| s3Bucket | string | Conditional | — | S3 bucket name |
| s3AccessKeyId | string | Conditional | — | AWS access key |
| s3SecretAccessKey | string | Conditional | — | AWS secret key |
| s3Region | string | No | 'us-east-1' | AWS region |

**Validation Rules**:
- If `storageType === 's3'`, all S3 fields required
- If `storageType === 'auto'` and both local path and S3 credentials present → startup error
- `localStoragePath` must be absolute path

### Artifact (Conceptual)

A rendered diagram file (not a runtime class).

| Attribute | Type | Description |
|-----------|------|-------------|
| session_id | string (UUID) | Logical grouping identifier |
| artifact_id | string (UUID) | Unique artifact identifier |
| content_type | 'image/svg+xml' \| 'application/pdf' | MIME type |
| extension | 'svg' \| 'pdf' | File extension |
| size_bytes | number | Content size |

**Storage Patterns**:
- Local: `{basePath}/{session_id}/{artifact_id}.{extension}`
- S3: `{bucket}/{artifact_id}.{extension}` (flat structure)

### Session (Conceptual)

A logical grouping of artifacts represented as a directory.

| Attribute | Type | Description |
|-----------|------|-------------|
| session_id | string (UUID) | Directory name |
| created_at | Date | Directory creation time |

**Lifecycle**:
- Created lazily on first artifact write
- Never automatically deleted (per FR-016)
- User manages cleanup manually

## Entity Relationships

```
StorageBackend (interface)
    │
    ├── LocalStorageBackend
    │       │
    │       └── stores → Artifact (on local filesystem)
    │               │
    │               └── organized in → Session (directory)
    │
    └── S3StorageBackend
            │
            └── stores → Artifact (in S3 bucket)

StorageConfig
    │
    └── configures → createStorageBackend() factory
            │
            └── returns → StorageBackend implementation

MCP Tools (mermaid_to_svg, mermaid_to_pdf, mermaid_to_deck)
    │
    └── use → StorageBackend.store()
            │
            └── returns → StorageResult

CDN Proxy
    │
    ├── local mode → reads from filesystem directly
    │
    └── s3 mode → fetches from S3 (existing behavior)
```

## File System Layout

### Container View
```
/app/data/artifacts/
├── {session_id_1}/
│   ├── {artifact_id_1}.svg
│   ├── {artifact_id_2}.pdf
│   └── {artifact_id_3}.svg
├── {session_id_2}/
│   └── {artifact_id_4}.pdf
└── .tmp files (orphaned, cleaned on startup)
```

### Host View (with volume mount)
```
${HOST_STORAGE_PATH}/
├── {session_id_1}/
│   ├── {artifact_id_1}.svg
│   └── ...
└── ...
```

## URL Generation

### Local Storage URLs (LOCAL_URL_SCHEME=file, default)
```
# HOST_STORAGE_PATH=/mnt/mermaid/artifacts
# Session: 550e8400-e29b-41d4-a716-446655440000
# Artifact: 6ba7b810-9dad-11d1-80b4-00c04fd430c8

file:///mnt/mermaid/artifacts/550e8400-e29b-41d4-a716-446655440000/6ba7b810-9dad-11d1-80b4-00c04fd430c8.svg
```

### Local Storage URLs (LOCAL_URL_SCHEME=http)
```
# CDN_HOST=mermaid-svc, CDN_PORT=3001
# Session: 550e8400-e29b-41d4-a716-446655440000
# Artifact: 6ba7b810-9dad-11d1-80b4-00c04fd430c8

http://mermaid-svc:3001/artifacts/550e8400-e29b-41d4-a716-446655440000/6ba7b810-9dad-11d1-80b4-00c04fd430c8.svg
```

### S3 Storage URLs (existing)
```
https://s3.us-east-1.amazonaws.com/bucket/6ba7b810-9dad-11d1-80b4-00c04fd430c8.svg?X-Amz-Algorithm=...
```

### CDN Proxy URLs (unified)
```
http://localhost:3001/artifacts/550e8400-e29b-41d4-a716-446655440000/6ba7b810-9dad-11d1-80b4-00c04fd430c8.svg
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| STORAGE_TYPE | No | 'auto' | Backend: 'auto', 'local', 's3' |
| LOCAL_STORAGE_PATH | No | '/app/data/artifacts' | Container storage path |
| HOST_STORAGE_PATH | Conditional | — | Host path for file:// URLs |
| MERMAID_S3_ENDPOINT | Conditional | — | S3/MinIO endpoint |
| MERMAID_S3_BUCKET | Conditional | — | S3 bucket name |
| MERMAID_S3_ACCESS_KEY | Conditional | — | AWS access key ID |
| MERMAID_S3_SECRET_KEY | Conditional | — | AWS secret access key |
| MERMAID_S3_REGION | No | 'us-east-1' | AWS region |
