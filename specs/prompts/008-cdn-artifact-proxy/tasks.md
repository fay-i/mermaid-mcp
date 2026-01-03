# CDN Artifact Proxy — Tasks Prompt

Generate tasks for implementing the CDN artifact proxy service.

## Phase 1: Research & Foundation

- Research Node.js HTTP server options (built-in `http` module vs micro-frameworks)
- Research AWS SDK v3 streaming for efficient S3 proxying
- Research LRU cache libraries for Node.js
- Design API endpoint structure and URL format
- Define error response format (JSON errors)
- Create spec document with findings

## Phase 2: Core HTTP Proxy

- Create `src/cdn-proxy/` directory structure
- Implement S3 client configuration (reuse existing or new)
- Implement HTTP server with `/artifacts/:session/:artifact` endpoint
- Implement `/health` endpoint with S3 connectivity check
- Implement Content-Type detection from file extension
- Implement streaming from S3 to HTTP response
- Implement error handling (404, 502, 503)
- Unit tests for HTTP handlers
- Unit tests for S3 client integration

## Phase 3: In-Memory Caching

- Add LRU cache dependency (if needed)
- Implement cache layer between HTTP and S3
- Implement cache key generation (`session/artifact.ext`)
- Implement size-based eviction (configurable max size)
- Implement TTL-based expiration (configurable)
- Add cache hit/miss headers (`X-Cache: HIT` or `MISS`)
- Unit tests for cache behavior

## Phase 4: Kubernetes Deployment

- Create Secret manifest for S3 credentials (`mermaid-s3-credentials`)
- Create Deployment manifest for CDN proxy
- Create Service manifest (LoadBalancer, port 8101)
- Update kustomization.yaml to include new resources
- Add environment variable injection from secret
- Add health check probes (liveness, readiness)
- Test deployment on k3s cluster

## Phase 5: MCP Integration

- Add `MERMAID_CDN_BASE_URL` configuration option
- Modify artifact output schema to include `cdn_url`
- Update `mermaid_to_svg` to include `cdn_url` in response
- Update `mermaid_to_pdf` to include `cdn_url` in response
- Conditional inclusion (only if CDN configured)
- Update existing tool tests

## Phase 6: Docker & CI

- Create entrypoint for CDN proxy (`cdn-proxy.js` or separate)
- Update Dockerfile for multi-mode image (MCP or CDN)
- Add CI workflow for CDN proxy tests
- Add integration test for end-to-end CDN flow
- Update documentation and README

## Task Dependencies

```
Phase 1 (Research)
    │
    ▼
Phase 2 (Core HTTP Proxy)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3 (Caching)   Phase 4 (K8s)
    │                  │
    └────────┬─────────┘
             ▼
      Phase 5 (MCP Integration)
             │
             ▼
      Phase 6 (Docker & CI)
```

## Acceptance Tests

Each phase should include tests verifying:

- **Phase 2**: HTTP server starts, artifacts retrieved from S3, correct Content-Type, error responses
- **Phase 3**: Cache hits reduce S3 calls, eviction works, TTL expiration works
- **Phase 4**: Deployment runs on k3s, credentials loaded from secret, service accessible
- **Phase 5**: MCP tools return `cdn_url`, URL is valid and matches artifact
- **Phase 6**: Docker image works in CDN mode, CI passes

## User Stories

### US1: Basic Artifact Retrieval
As a LAN client, I can retrieve an artifact via HTTP GET without S3 credentials.

### US2: Correct Content Types
As a client, I receive artifacts with correct Content-Type headers (SVG, PDF).

### US3: Health Check
As an operator, I can verify CDN proxy health and S3 connectivity.

### US4: Caching
As a system, cached artifacts are served without S3 round-trip.

### US5: MCP Integration
As an MCP client, I receive `cdn_url` in artifact responses.

### US6: k3s Deployment
As an operator, I can deploy the CDN proxy to k3s using kubectl.
