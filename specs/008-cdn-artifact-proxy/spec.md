# Feature Specification: CDN Artifact Proxy

**Feature Branch**: `008-cdn-artifact-proxy`
**Created**: 2026-01-02
**Status**: Draft
**Input**: Add an HTTP proxy service that serves cached S3 artifacts over plain HTTP for LAN clients that cannot use S3 credentials directly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrieve Artifact via HTTP (Priority: P1)

A LAN client (such as a developer workstation, CI/CD pipeline, or internal tool) needs to retrieve a rendered Mermaid artifact (SVG or PDF) without having S3 credentials or SDK access. The client makes a simple HTTP GET request to the CDN proxy, which handles S3 authentication transparently and returns the artifact content.

**Why this priority**: This is the core functionality - without artifact retrieval, the proxy has no purpose. Every other feature depends on this working.

**Independent Test**: Can be fully tested by making an HTTP GET request to `/artifacts/{artifactId}.svg` and verifying the SVG content is returned with correct headers.

**Acceptance Scenarios**:

1. **Given** an artifact exists in S3 with ID "def456", **When** a client requests `GET /artifacts/def456.svg`, **Then** the system returns the SVG content with `Content-Type: image/svg+xml` and status 200
2. **Given** an artifact exists in S3 as PDF, **When** a client requests `GET /artifacts/{artifactId}.pdf`, **Then** the system returns the PDF binary with `Content-Type: application/pdf` and status 200
3. **Given** an artifact does not exist in S3, **When** a client requests the artifact URL, **Then** the system returns status 404 with error code `ARTIFACT_NOT_FOUND`
4. **Given** S3 credentials are configured, **When** a client makes a request, **Then** the client does not need to provide any authentication

---

### User Story 2 - Health Monitoring (Priority: P2)

Operations teams need to monitor the CDN proxy service health and verify that S3 connectivity is functioning. A health endpoint provides real-time status information including S3 connection verification.

**Why this priority**: Critical for production operations - monitoring systems need health checks to detect issues before users are impacted.

**Independent Test**: Can be fully tested by calling `GET /health` and verifying the response contains service status and S3 connectivity status.

**Acceptance Scenarios**:

1. **Given** the proxy service is running and S3 is reachable, **When** a client requests `GET /health`, **Then** the system returns `{"ok": true, "service": "cdn-proxy", "s3_connected": true, "timestamp": "..."}` with status 200
2. **Given** the proxy service is running but S3 is unreachable, **When** a client requests `GET /health`, **Then** the system returns `{"ok": false, "service": "cdn-proxy", "s3_connected": false, ...}` with appropriate status

---

### User Story 3 - In-Memory Caching (Priority: P3)

To reduce load on the S3 storage and improve response times for frequently accessed artifacts, the proxy caches artifact content in memory. Repeated requests for the same artifact are served from cache.

**Why this priority**: Performance optimization that enhances the core functionality. The system works without caching, but caching improves efficiency significantly for repeated requests.

**Independent Test**: Can be fully tested by requesting the same artifact twice and measuring response time improvement on the second request, or by verifying only one S3 request is made for repeated artifact requests.

**Acceptance Scenarios**:

1. **Given** caching is enabled and an artifact has been requested once, **When** the same artifact is requested again within the cache TTL, **Then** the response is served from cache (faster response, no additional S3 request)
2. **Given** caching is enabled with a max size limit, **When** the cache exceeds the configured size, **Then** least recently used artifacts are evicted to make room
3. **Given** an artifact's cache TTL has expired, **When** the artifact is requested, **Then** the system fetches fresh content from S3
4. **Given** caching is disabled via configuration, **When** artifacts are requested, **Then** every request fetches from S3 directly

---

### User Story 4 - MCP Tool Response Enhancement (Priority: P4)

When the CDN proxy is available, the MCP render tools should include a `cdn_url` field in their responses alongside the existing `s3_url`. This allows clients to choose the most appropriate URL for their access method.

**Why this priority**: Integration feature that enhances usability but requires the core proxy to be working first. The MCP tools continue to work without this enhancement.

**Independent Test**: Can be fully tested by calling an MCP render tool and verifying the response includes both `s3_url` and `cdn_url` fields when CDN is configured.

**Acceptance Scenarios**:

1. **Given** CDN proxy is configured and available, **When** `mermaid_to_svg` or `mermaid_to_pdf` completes successfully, **Then** the response includes a `cdn_url` field with the HTTP proxy URL
2. **Given** CDN proxy is not configured, **When** a render tool completes successfully, **Then** the response includes only the `s3_url` field (no `cdn_url`)

---

### Edge Cases

- What happens when an artifact path is malformed (non-UUID format, path traversal attempts, unsupported extension)? System returns 400 with `INVALID_PATH` error code
- What happens when S3 credentials are not configured at startup? Service starts but returns 503 with `NOT_CONFIGURED` for artifact requests; health endpoint shows `s3_connected: false`
- What happens when S3 returns a transient error? System returns 502 with `S3_ERROR` and appropriate error message
- What happens when cache memory is exhausted? LRU eviction removes oldest entries; new requests still succeed
- What happens when concurrent requests arrive for the same uncached artifact? Only one S3 request is made; other requests wait for and share the result

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve artifacts via HTTP GET requests to `/artifacts/{artifactId}.{ext}` path pattern
- **FR-002**: System MUST authenticate with S3 using credentials from Kubernetes secrets (not environment files)
- **FR-003**: System MUST return appropriate `Content-Type` headers (`image/svg+xml` for SVG, `application/pdf` for PDF)
- **FR-004**: System MUST include `Content-Length`, `Cache-Control`, `X-Artifact-Id`, and `X-Request-Id` headers in responses
- **FR-005**: System MUST provide a health endpoint at `GET /health` that reports service and S3 connectivity status
- **FR-006**: System MUST return structured error responses with standard HTTP status codes (404, 400, 502, 503) and error codes
- **FR-007**: System MUST support configurable in-memory caching with LRU eviction
- **FR-008**: System MUST support configurable cache TTL (default: 24 hours) and maximum cache size (default: 256MB)
- **FR-009**: System MUST run on port 8101 by default (configurable)
- **FR-010**: System MUST operate as a stateless service (no persistent storage required)
- **FR-011**: System MUST be deployable to Kubernetes with secret-based credential injection
- **FR-012**: MCP render tools MUST include `cdn_url` in responses when CDN proxy is configured
- **FR-013**: System MUST emit structured JSON logs for each request including request ID, path, response status, duration (ms), and cache hit/miss indicator

### Key Entities

- **Artifact**: A rendered Mermaid diagram (SVG or PDF) identified by session ID and artifact UUID; each render produces a unique UUID (no versioning of artifacts)
- **Session**: A logical grouping of artifacts owned by a single MCP session, identified by session ID
- **Cache Entry**: An in-memory representation of an artifact with metadata (last access time, size, TTL expiration)
- **Health Status**: Real-time service state including S3 connectivity verification

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Clients can retrieve artifacts via HTTP without any authentication headers or S3 credentials
- **SC-002**: Artifact retrieval requests complete within 500ms for cached content
- **SC-003**: Health endpoint responds within 100ms with accurate S3 connectivity status
- **SC-004**: System handles 100 concurrent artifact requests without errors, maintaining p99 latency < 2000ms and error rate < 1%
- **SC-005**: Cache reduces S3 requests by at least 50% for workloads with repeated artifact access
- **SC-006**: System gracefully handles S3 outages by returning appropriate error codes without crashing
- **SC-007**: MCP tool users can access artifacts using the simpler `cdn_url` without configuring S3 access

## Assumptions

- The Kubernetes secret `mermaid-s3-credentials` exists and contains valid S3 endpoint, bucket, access key, secret key, and region values
- The CDN proxy runs on a trusted LAN network where authentication is not required for artifact access
- Artifacts are immutable once stored - cache invalidation is not required; new versions of a diagram produce new artifact UUIDs
- The MinIO S3 service is network-reachable from the CDN proxy pods
- Standard web performance expectations apply (sub-second responses for typical operations)
- LRU caching with configurable TTL and size limits is appropriate for the access patterns
- Rate limiting is not required; Kubernetes resource limits provide sufficient protection on the trusted LAN

## Constraints

- HTTP only (TLS termination handled by nginx/ingress, not the proxy itself)
- LAN access only - not designed for public internet exposure
- Credentials loaded from Kubernetes secrets only (not environment files or config maps)
- Must work with existing MinIO S3 infrastructure without modifications

## Out of Scope

The following capabilities are explicitly excluded from this feature:

- **Authentication/Authorization**: No client authentication required; trusted LAN access model
- **Artifact Upload/Delete**: Read-only proxy; write operations remain via MCP tools and S3 directly
- **TLS Termination**: Handled by nginx/ingress layer, not this service
- **Public Internet Access**: Designed for LAN-only deployment; not hardened for public exposure
- **API Versioning**: No URL or header versioning; artifact UUIDs provide natural versioning

## Clarifications

### Session 2026-01-02

- Q: What logging, metrics, or tracing should the CDN proxy emit for operational visibility? → A: Structured request logging only (JSON logs with request ID, duration, cache hit/miss)
- Q: Should the CDN proxy enforce any rate limiting to prevent abuse or resource exhaustion? → A: No rate limiting (trusted LAN, rely on Kubernetes resource limits)
- Q: What should be the default values for cache TTL and maximum cache size? → A: TTL: 24 hours, Size: 256MB (aggressive caching for immutable artifacts)
- Q: What capabilities should be explicitly excluded from this feature? → A: Authentication/authorization, artifact upload/delete, TLS termination, public internet access
- Q: Should the API include versioning in the URL path for future compatibility? → A: No API versioning; each artifact has its own UUID, new versions get new UUIDs
