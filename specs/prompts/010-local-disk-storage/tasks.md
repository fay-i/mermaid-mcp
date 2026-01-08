# Local Disk Storage — Tasks Prompt

Generate tasks for implementing local disk storage as the default storage option with S3 as an optional alternative.

## Phase 1: Storage Abstraction Foundation

### Research & Design
- Research Node.js `fs/promises` atomic write patterns
- Research file:// URL format standards and cross-platform compatibility
- Design `StorageBackend` interface with all required methods
- Design error taxonomy for storage operations
- Document backend selection algorithm (auto-detection)
- Create architecture diagram for storage abstraction layer

### Interface Definition
- Create `src/storage/types.ts` with `StorageBackend` interface
- Define `StorageResult` interface for store() responses
- Define storage-specific error types (`StorageError`, `NotFoundError`, `PermissionError`, `DiskFullError`)
- Add JSDoc documentation for all interfaces
- Unit tests for interface compliance (using mock implementations)

## Phase 2: Local Storage Implementation

### Core Implementation
- Create `src/storage/local-backend.ts` implementing `StorageBackend`
- Implement `store()` with atomic write (temp file + rename)
- Implement `retrieve()` with error handling
- Implement `delete()` with safe removal
- Implement `exists()` with filesystem check
- Implement `getType()` returning `'local'`
- Add session directory management (lazy creation)
- Add file extension detection from Content-Type

### URL Generation
- Implement file:// URL construction logic
- Add configuration for CDN base URL override
- Add path normalization for cross-platform compatibility
- Validate generated URLs at runtime
- Unit tests for URL generation

### Error Handling
- Implement disk space checking
- Implement permission validation at startup
- Handle ENOSPC (disk full) errors gracefully
- Handle EACCES (permission denied) errors
- Handle ENOENT (not found) errors
- Add specific error codes for each failure type
- Unit tests for error scenarios

### Atomic Write Safety
- Implement write to `.tmp` suffix file
- Implement atomic rename after successful write
- Add cleanup logic for orphaned temp files on startup
- Add recovery logic for interrupted writes
- Unit tests for atomic write behavior

### Tests
- Unit tests for all `LocalStorageBackend` methods
- Unit tests for directory management
- Unit tests for error handling
- Unit tests for atomic writes
- Integration tests for file persistence

## Phase 3: S3 Backend Refactoring

### Extract S3 Logic
- Create `src/storage/s3-backend.ts` implementing `StorageBackend`
- Extract existing S3 logic from `src/storage/s3-client.ts`
- Implement `store()` wrapping existing S3 upload
- Implement `retrieve()` wrapping existing S3 download
- Implement `delete()` wrapping existing S3 delete
- Implement `exists()` using S3 HeadObject
- Implement `getType()` returning `'s3'`
- Preserve existing presigned URL generation
- Add error mapping (S3 errors → storage errors)

### Backwards Compatibility
- Ensure existing S3 behavior unchanged
- Test presigned URL generation
- Test S3 credential validation
- Test existing error handling
- Integration tests for S3 backend

## Phase 4: Backend Selection & Configuration

### Configuration Module
- Create `src/storage/config.ts` for storage configuration
- Parse `STORAGE_TYPE` environment variable
- Parse `LOCAL_STORAGE_PATH` environment variable
- Parse `CDN_BASE_URL` environment variable
- Parse existing S3 environment variables
- Validate configuration at startup
- Add configuration schema with Zod
- Unit tests for configuration parsing

### Auto-Detection Logic
- Implement `selectStorageBackend()` factory function
- Implement auto-detection (check for S3 credentials)
- Add explicit override with `STORAGE_TYPE=local|s3|auto`
- Add startup logging for selected backend
- Add validation for required environment variables
- Handle misconfiguration gracefully
- Unit tests for backend selection

### Startup Validation
- Validate local storage write permissions
- Validate local storage disk space availability
- Validate S3 credentials if S3 backend selected
- Fail fast with clear error messages
- Log selected backend and configuration
- Add health check for storage backend
- Integration tests for startup validation

## Phase 5: Tool Integration

### Update Tool Logic
- Refactor `tools/mermaid-to-svg.ts` to use storage abstraction
- Refactor `tools/mermaid-to-pdf.ts` to use storage abstraction
- Refactor `tools/mermaid-to-deck.ts` to use storage abstraction
- Replace direct S3 calls with `storageBackend.store()`
- Add `storage_type` field to tool responses
- Update error handling for storage errors
- Integration tests for each tool

### Schema Updates
- Update `schemas/artifact-output.ts` to include `storage_type`
- Update response examples in schemas
- Add storage_type to output validation
- Update schema documentation
- Unit tests for updated schemas

## Phase 6: CDN Proxy Updates

### Storage Backend Detection
- Add storage backend detection to CDN proxy startup
- Read same environment variables as MCP server
- Log selected backend (local vs S3)
- Initialize appropriate backend

### Local File Serving
- Create `src/cdn-proxy/handlers/local-file-handler.ts`
- Implement GET handler for local file requests
- Map URL path to filesystem path
- Implement streaming file response
- Add Content-Type detection from file extension
- Add error handling (404, 403, 500)
- Unit tests for local file handler

### Router Updates
- Update `src/cdn-proxy/router.ts` to support both backends
- Route to local handler if `storage_type === 'local'`
- Route to S3 handler if `storage_type === 's3'`
- Add backend type to response headers (`X-Storage-Backend`)
- Integration tests for routing logic

### Health Check Updates
- Update CDN proxy health check to show storage backend
- Add storage backend status to health response
- Test CDN proxy health check with both backends

## Phase 7: Docker & Deployment Configuration

### Dockerfile Updates
- Add volume mount definition: `VOLUME ["/app/data/artifacts"]`
- Create `/app/data/artifacts` directory in image
- Set appropriate permissions for volume directory
- Update Docker build documentation
- Test Docker build with volume definition

### Docker Compose Configuration
- Create `docker-compose.local.yml` for local storage example
- Add volume mount: `/mnt/mermaid/artifacts:/app/data/artifacts`
- Configure environment variables for local storage
- Add comments explaining configuration
- Test docker-compose deployment

### Kubernetes Updates
- Update `k8s/deployment.yaml` with optional volume mount
- Add ConfigMap for local storage configuration
- Document local storage setup for Kubernetes
- Test Kubernetes deployment (optional, staging only)

### Environment Variable Documentation
- Document all storage-related environment variables
- Add examples for local storage configuration
- Add examples for S3 storage configuration
- Add examples for auto-detection
- Create troubleshooting guide for common issues

## Phase 8: Testing & Validation

### Unit Tests
- Storage backend interface compliance tests
- Local backend: file operations
- Local backend: atomic writes
- Local backend: error handling
- S3 backend: wrapper logic
- Backend selection: auto-detection
- Backend selection: explicit override
- Configuration parsing tests

### Integration Tests
- End-to-end: MCP tool → local storage → artifact retrieval
- End-to-end: MCP tool → S3 storage → artifact retrieval
- CDN proxy: local file serving
- CDN proxy: S3 proxying
- Docker: volume mount persistence
- Docker: restart persistence
- Configuration: various environment variable combinations

### Performance Tests
- Local storage: write latency
- Local storage: read latency
- S3 storage: write latency (baseline)
- S3 storage: read latency (baseline)
- Compare local vs S3 performance

## Phase 9: Documentation & Polish

### User Documentation
- Update README.md with local storage setup
- Add "Quick Start with Local Storage" section
- Add "Configuration Reference" section
- Add "Storage Backend Selection" guide
- Add "Troubleshooting" section
- Add "Migration from S3 to Local" guide (if applicable)

### Architecture Documentation
- Document storage abstraction layer
- Create architecture diagram (local vs S3)
- Document auto-detection algorithm
- Document error handling strategy
- Add sequence diagrams for key flows

### Code Documentation
- Add JSDoc to all public interfaces
- Add inline comments for complex logic
- Update CONTRIBUTING.md with storage backend guidelines
- Add code examples for extending storage backends

### Examples & Tutorials
- Create example: local storage with docker-compose
- Create example: S3 storage with docker-compose
- Create example: auto-detection setup
- Create example: Kubernetes with local storage
- Add tutorial: switching between backends

## Phase 10: Cleanup & Review

### Code Review
- Review all changes for consistency
- Review error handling completeness
- Review test coverage (target: >90%)
- Review documentation completeness
- Address any technical debt introduced

### Performance Review
- Profile local storage operations
- Profile S3 storage operations
- Identify and optimize hot paths
- Validate no performance regressions

### Security Review
- Review file path validation (prevent traversal)
- Review permission handling
- Review error message content (no sensitive data)
- Review volume mount security implications

## Task Dependencies

```
Phase 1 (Foundation)
    │
    ├──────────────────┬────────────────┐
    ▼                  ▼                ▼
Phase 2 (Local)  Phase 3 (S3)    Phase 4 (Config)
    │                  │                │
    └──────────┬───────┴────────────────┘
               ▼
        Phase 5 (Tools)
               │
               ├──────────────────┐
               ▼                  ▼
        Phase 6 (CDN)      Phase 7 (Docker)
               │                  │
               └────────┬─────────┘
                        ▼
                 Phase 8 (Testing)
                        │
                        ▼
                 Phase 9 (Docs)
                        │
                        ▼
                 Phase 10 (Cleanup)
```

## Acceptance Criteria

Each phase must meet these criteria before proceeding:

### Phase 1: Foundation
- ✅ Storage interface defined with complete method signatures
- ✅ Error types defined and documented
- ✅ Mock implementation tests pass

### Phase 2: Local Storage
- ✅ All interface methods implemented
- ✅ Atomic write behavior verified
- ✅ Error handling tested
- ✅ Unit test coverage >90%

### Phase 3: S3 Refactoring
- ✅ S3 backend implements interface
- ✅ Existing S3 behavior unchanged
- ✅ All S3 tests passing

### Phase 4: Configuration
- ✅ Auto-detection works correctly
- ✅ Explicit override works
- ✅ Startup validation catches misconfigurations
- ✅ Clear logging of selected backend

### Phase 5: Tool Integration
- ✅ All tools use storage abstraction
- ✅ Tools work with local storage
- ✅ Tools work with S3 storage
- ✅ Integration tests pass

### Phase 6: CDN Proxy
- ✅ CDN serves local files
- ✅ CDN proxies S3 files
- ✅ Routing works correctly
- ✅ Health check shows backend type

### Phase 7: Docker
- ✅ Dockerfile builds with volume mount
- ✅ docker-compose.yml works
- ✅ Artifacts persist across restarts

### Phase 8: Testing
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Performance benchmarks complete
- ✅ Test coverage >90%

### Phase 9: Documentation
- ✅ README updated
- ✅ Architecture docs complete
- ✅ Examples working
- ✅ Troubleshooting guide complete

### Phase 10: Cleanup
- ✅ Code review complete
- ✅ No technical debt outstanding
- ✅ Performance validated
- ✅ Security review complete

## User Stories

### US1: Local Storage Default
**As a developer**, I want the MCP server to use local filesystem storage by default, so I don't need to set up S3 for testing.

**Acceptance**: 
- Server starts without S3 credentials
- Artifacts stored in local filesystem
- File URLs returned in responses

### US2: S3 Optional
**As an operator**, I want S3 storage to be optional and configured via environment variables, so I can choose the appropriate backend for my deployment.

**Acceptance**:
- S3 activates when credentials provided
- No S3 errors when credentials absent
- Clear logging of selected backend

### US3: Volume Persistence
**As a user**, I want artifacts to persist across container restarts, so my work is not lost.

**Acceptance**:
- Volume mount configured in docker-compose
- Artifacts available after restart
- No data loss

### US4: Seamless Backend Switch
**As an operator**, I want to switch between local and S3 storage by changing environment variables, with no code changes.

**Acceptance**:
- Change `STORAGE_TYPE` → restart → new backend active
- Add S3 credentials → auto-detected → S3 active
- Remove S3 credentials → auto-detected → local active

### US5: File URL Access
**As a user**, I want to access artifacts via file:// URLs that resolve to the correct host path, so I can open them directly.

**Acceptance**:
- File URLs start with `file://`
- URLs point to correct host path
- Files accessible from host machine
