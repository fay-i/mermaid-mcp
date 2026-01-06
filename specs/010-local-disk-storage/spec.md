# Feature Specification: Local Disk Storage with Docker Volume Mount

**Feature Branch**: `010-local-disk-storage`  
**Created**: January 6, 2026  
**Status**: Draft  
**Input**: User description: "Enable local filesystem storage as the default storage option via Docker volume mount, with S3 as an optional alternative configured by environment variables. The CDN proxy should serve artifacts via file:// URLs with resolved host paths."

## Clarifications

### Session 2026-01-06

- Q: How does the system know the host mount path (which could differ from the container's internal path) to construct file:// URLs? → A: Host path provided via environment variable `HOST_STORAGE_PATH`, container uses volume mount target
- Q: Should there be a retention policy or disk space management for successful artifacts? → A: No automatic cleanup - artifacts persist indefinitely, user manages cleanup
- Q: When STORAGE_TYPE=auto, what detection priority when both local storage path and S3 credentials are configured? → A: Fail startup with error requiring explicit STORAGE_TYPE setting
- Q: Should orphaned .tmp file cleanup be immediate (all) or time-based? → A: Clean up all .tmp files on startup (any .tmp at startup is orphaned)
- Q: Should CDN proxy support HTTP range requests or just full file downloads? → A: Support only full file downloads (200 OK) - simpler, sufficient for small artifacts
- Q: What documentation and packaging deliverables are required? → A: Update README with Docker and local setup instructions, provide architecture diagram as Mermaid code at repo root (not committed), package for npm install or npx execution as @fay-i/mermaid-mcp

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local Development with Filesystem Storage (Priority: P1)

A developer wants to run the MCP server locally for development and testing without needing to set up S3 infrastructure. They want artifacts to persist across container restarts and be accessible via file paths.

**Why this priority**: This is the foundational capability that removes the S3 dependency for basic usage. It enables developers to get started immediately without infrastructure setup, which is the core problem this feature solves.

**Independent Test**: Can be fully tested by starting the server without S3 credentials, rendering a diagram, stopping the container, restarting it, and verifying the artifact still exists at the file:// URL.

**Acceptance Scenarios**:

1. **Given** the MCP server is started without S3 credentials configured, **When** a user renders a diagram, **Then** the artifact is saved to the local filesystem and a file:// URL is returned
2. **Given** artifacts exist in the mounted volume, **When** the container is restarted, **Then** all previously created artifacts remain accessible at their original URLs
3. **Given** the host volume mount is configured as `/mnt/mermaid/artifacts`, **When** an artifact is created, **Then** it is accessible on the host filesystem at `/mnt/mermaid/artifacts/<session>/<artifact>`

---

### User Story 2 - S3 Storage Configuration (Priority: P2)

A production deployment operator wants to use S3 storage for scalability and durability, switching from local storage by setting environment variables without code changes.

**Why this priority**: This ensures backward compatibility and provides production-ready storage options. It's lower priority than P1 because local storage must work first, then S3 becomes an option.

**Independent Test**: Can be tested by starting the server with S3 environment variables configured, rendering a diagram, and verifying the artifact is stored in S3 with an HTTPS URL returned.

**Acceptance Scenarios**:

1. **Given** S3 credentials are configured via environment variables, **When** the MCP server starts, **Then** it automatically uses S3 storage and logs the storage backend selection
2. **Given** S3 storage is active, **When** a user renders a diagram, **Then** the artifact is uploaded to S3 and an HTTPS presigned URL is returned
3. **Given** the operator switches from S3 to local storage by removing S3 environment variables, **When** the server restarts, **Then** new artifacts are saved to local filesystem without errors

---

### User Story 3 - CDN Proxy with Local Files (Priority: P3)

An API consumer wants to retrieve artifacts through the CDN proxy endpoint, regardless of whether storage is local or S3, using the same HTTP interface.

**Why this priority**: This provides a consistent retrieval interface but depends on the storage backends being functional first. It's primarily a convenience feature for API consistency.

**Independent Test**: Can be tested by requesting an artifact via the CDN proxy endpoint and verifying it returns the file content with appropriate headers, whether stored locally or in S3.

**Acceptance Scenarios**:

1. **Given** an artifact is stored locally, **When** a user requests it via the CDN proxy endpoint, **Then** the file is served as a complete download (HTTP 200) with correct content type headers
2. **Given** an artifact is stored in S3, **When** a user requests it via the CDN proxy endpoint, **Then** the proxy fetches it from S3 and returns it (existing behavior)
3. **Given** a requested artifact does not exist, **When** a user requests it via the CDN proxy, **Then** a 404 error is returned with an appropriate error message

---

### User Story 4 - Documentation and Package Distribution (Priority: P4)

A new user wants to quickly start using the MCP server either via Docker or locally, and an npm user wants to install or execute the package without manual setup.

**Why this priority**: This is essential for adoption but depends on core functionality being complete first. Documentation and packaging are final deliverables that make the feature accessible.

**Independent Test**: Can be tested by following README instructions for both Docker and local setup, verifying they work end-to-end. Package can be tested by installing via npm and executing via npx.

**Acceptance Scenarios**:

1. **Given** a user follows Docker setup instructions in README, **When** they run the provided docker commands, **Then** the server starts successfully with local storage configured
2. **Given** a user follows local setup instructions in README, **When** they run the setup and start commands, **Then** the server runs on their host machine with local storage
3. **Given** a user runs `npm install @fay-i/mermaid-mcp`, **When** they start the server, **Then** it runs with all dependencies properly bundled
4. **Given** a user runs `npx @fay-i/mermaid-mcp`, **When** the command executes, **Then** the server starts without requiring prior installation
5. **Given** an architecture.mmd file exists at repo root, **When** viewed with a Mermaid renderer, **Then** it displays the storage architecture diagram with local and S3 backends

---

### Edge Cases

- What happens when the host disk is full and a write is attempted?
  - System logs error and returns `STORAGE_FULL` error code to client
  - No partial artifacts are left on disk (atomic writes prevent this)

- How does the system handle missing write permissions on the mounted volume?
  - Startup health check detects this and fails fast with clear error message
  - Server does not start if write access cannot be verified

- What happens when the Docker volume mount is not configured?
  - Server starts successfully but artifacts are stored in ephemeral container storage
  - Warning is logged indicating artifacts will not persist across restarts

- What happens when both S3 credentials and local storage are configured with STORAGE_TYPE=auto?
  - Server fails startup with clear error message requiring explicit STORAGE_TYPE setting (local or s3)
  - This prevents ambiguous storage backend selection

- How does the system handle file name collisions?
  - Artifact IDs are UUIDs, making collisions virtually impossible
  - If collision occurs (overwrite scenario), newest write wins

- What happens if the process crashes mid-write?
  - Atomic write strategy (temp file + rename) prevents partial files
  - Orphaned `.tmp` files are cleaned up on next server startup (all .tmp files removed regardless of age)

- How does the system behave with concurrent writes to the same session directory?
  - File system operations are atomic per file
  - Different artifact IDs prevent conflicts
  - Session directory creation is idempotent

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support local filesystem storage as the default storage backend when S3 credentials are not configured
- **FR-002**: System MUST persist artifacts in a Docker volume mounted from host to container path
- **FR-003**: System MUST organize artifacts using the pattern `<storage-root>/<session_id>/<artifact_id>.<ext>`
- **FR-004**: System MUST return file:// URLs with host-resolvable absolute paths constructed using `HOST_STORAGE_PATH` environment variable for locally stored artifacts
- **FR-004a**: System MUST read `HOST_STORAGE_PATH` environment variable to determine the host filesystem path for constructing file:// URLs
- **FR-004b**: System MUST support `LOCAL_URL_SCHEME` configuration with values `file` (default) or `http` to determine URL format for locally stored artifacts
- **FR-004c**: When `LOCAL_URL_SCHEME=file`, URLs use format `file://{HOST_STORAGE_PATH}/{session}/{artifact}.{ext}`
- **FR-004d**: When `LOCAL_URL_SCHEME=http`, URLs use format `http://{CDN_HOST}:{CDN_PORT}/artifacts/{session}/{artifact}.{ext}`
- **FR-005**: System MUST automatically detect and use S3 storage when AWS environment variables are present
- **FR-006**: System MUST implement an abstraction layer with a `StorageBackend` interface that both local and S3 storage implement
- **FR-007**: System MUST perform atomic writes using temporary files with rename operations to prevent partial artifacts
- **FR-007a**: System MUST clean up all `.tmp` files in the storage directory on startup, as any temporary file present at startup is orphaned
- **FR-008**: System MUST verify write access to the storage path during startup and fail fast if unavailable
- **FR-009**: System MUST log the selected storage backend (local or S3) at startup for operational visibility
- **FR-010**: System MUST create session directories automatically as needed when storing artifacts
- **FR-011**: System MUST support storage backend selection via `STORAGE_TYPE` environment variable with values: `auto`, `local`, or `s3`
- **FR-011a**: When `STORAGE_TYPE=auto` and both local storage and S3 credentials are configured, system MUST fail startup with error requiring explicit `STORAGE_TYPE` setting
- **FR-012**: System MUST maintain zero breaking changes to existing S3 storage functionality
- **FR-013**: CDN proxy MUST serve locally stored artifacts by reading directly from the filesystem
- **FR-013a**: CDN proxy MUST support only full file downloads (HTTP 200 OK), not range requests (HTTP 206 Partial Content)
- **FR-014**: CDN proxy MUST detect storage backend at startup and route requests to appropriate handler (local or S3)
- **FR-015**: System MUST handle disk full errors gracefully by returning an error code without crashing
- **FR-016**: System MUST NOT implement automatic artifact cleanup or retention policies - artifacts persist indefinitely until manually deleted
- **FR-017**: README MUST include complete Docker setup instructions with environment variable configuration for both local and S3 storage
- **FR-018**: README MUST include local development setup instructions for running the server directly on the host
- **FR-019**: Repository MUST include an architecture.mmd file at root containing a Mermaid diagram showing storage backend architecture (local and S3)
- **FR-020**: The architecture.mmd file MUST be excluded from git commits via .gitignore
- **FR-021**: Package MUST be published to npm registry as `@fay-i/mermaid-mcp` with all required dependencies
- **FR-022**: Package MUST support execution via `npx @fay-i/mermaid-mcp` without prior installation
- **FR-023**: Package.json MUST include proper bin configuration, main entry point, and MCP server metadata

### Key Entities

- **StorageBackend**: Abstract interface representing a storage mechanism with operations: store, retrieve, delete, exists, and getType
- **LocalStorageBackend**: Implementation of StorageBackend using Node.js filesystem operations
- **S3StorageBackend**: Implementation of StorageBackend using AWS S3 SDK (existing, wrapped in interface)
- **Artifact**: A rendered diagram file with attributes: session ID, artifact ID, content type, size, storage URL
- **Session**: A logical grouping of artifacts, represented as a directory in the filesystem or key prefix in S3
- **Architecture Diagram**: Mermaid source code (architecture.mmd) showing storage backend architecture, kept at repo root but not committed
- **NPM Package**: Published package `@fay-i/mermaid-mcp` with executable bin configuration supporting both install and npx execution

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can start the MCP server and render diagrams without configuring S3, receiving working file:// URLs in under 30 seconds from first run
- **SC-002**: Artifacts stored locally persist across container restarts when volume is mounted, with 100% data retention
- **SC-003**: S3 storage activates automatically within 1 second of server startup when credentials are present, with clear log message
- **SC-004**: Storage backend selection is logged at startup with backend type visible in first 10 log lines
- **SC-005**: CDN proxy serves local files with response times under 100ms for files under 1MB
- **SC-006**: Zero changes required to existing S3 deployment configurations - all existing S3 users continue working without modification
- **SC-007**: Write permission errors are detected within 2 seconds of startup and prevent server from entering ready state
- **SC-008**: A user following Docker setup instructions can have the server running in under 2 minutes from README
- **SC-009**: A user following local setup instructions can have the server running in under 5 minutes including dependency installation
- **SC-010**: The architecture.mmd diagram accurately represents the StorageBackend interface and both implementations
- **SC-011**: Package can be executed via npx with zero configuration files required on user's machine

### Assumptions

- Host filesystem at volume mount point has sufficient disk space for artifact storage (monitoring is external concern)
- Docker volume mounts are configured correctly in deployment manifests (this is deployment responsibility)
- Session IDs and artifact IDs are UUIDs generated upstream, ensuring uniqueness
- File system supports atomic rename operations (standard POSIX behavior)
- Local storage is suitable for single-server deployments; multi-server deployments should use S3
- CDN proxy and rendering tools run in the same container and share access to the local filesystem
- Default retention policy is "keep forever" unless TTL-based cleanup is explicitly enabled via configuration
- Package is built and bundled before publishing to npm registry
- Users have Node.js 24+ installed for local execution or Docker for containerized execution
- The architecture.mmd file is generated during development but excluded from package distribution
