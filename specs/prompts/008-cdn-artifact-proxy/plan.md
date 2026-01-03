# CDN Artifact Proxy — Plan Prompt

Create an implementation plan for the CDN artifact proxy service.

## Key Architectural Decisions

1. Separate service vs sidecar container?
2. Same Docker image with different entrypoint or separate image?
3. In-memory cache implementation (LRU strategy, size limits)
4. How to inject `cdn_url` into MCP tool responses?
5. Health check strategy (S3 connectivity verification)
6. Kubernetes secret structure and mounting

## Context

- The MCP server already stores artifacts in MinIO S3 using presigned URLs
- Presigned URLs require clients to access MinIO directly with valid signatures
- LAN clients may not be able to use S3 credentials or access MinIO directly
- The CDN proxy provides a credential-free HTTP interface to the same artifacts
- k3s cluster already has MinIO running with credentials configured

## Research Needed

- How to mount k3s secrets as environment variables in deployment
- LRU cache library options for Node.js (`lru-cache`, `quick-lru`, etc.)
- AWS SDK v3 GetObject streaming for efficient proxying
- Node.js HTTP server performance for binary streaming

## Design Questions

1. **Service Architecture**: How should the CDN proxy be deployed?
   - Option A: Sidecar container sharing pod with mermaid-mcp
   - Option B: Separate deployment with its own service (recommended)
   - Option C: Additional endpoint in existing mermaid-mcp service

2. **Docker Strategy**: Same image or separate?
   - Option A: Same image, different entrypoint (`node dist/cdn-proxy.js`)
   - Option B: Separate Dockerfile for minimal CDN image
   - Option C: Multi-stage build with shared base

3. **S3 Credential Loading**: How to get credentials from k3s?
   - Secret mounted as environment variables
   - Secret mounted as files and read at startup
   - External secrets operator (if available)

4. **Caching Strategy**: How to cache artifacts in memory?
   - LRU cache with configurable max size
   - Cache key: `<session_id>/<artifact_id>`
   - Eviction: LRU with size-based limits
   - TTL: Configurable, default 1 hour

5. **Response Streaming**: How to proxy S3 content efficiently?
   - Stream directly from S3 to HTTP response (memory-efficient)
   - Cache small artifacts, stream large ones
   - Set threshold (e.g., cache if < 1MB)

6. **URL Discovery**: How do MCP tools know the CDN URL?
   - Environment variable: `MERMAID_CDN_BASE_URL`
   - Auto-discovery via Kubernetes service DNS
   - Configuration in MCP server config

## Implementation Order

1. **Phase 1: Core HTTP Proxy**
   - Node.js HTTP server
   - S3 client configuration
   - Basic artifact retrieval endpoint
   - Health check endpoint

2. **Phase 2: Kubernetes Deployment**
   - Secret definition
   - Deployment manifest
   - Service manifest
   - Kustomization updates

3. **Phase 3: In-Memory Caching**
   - LRU cache implementation
   - Cache hit/miss metrics
   - Configurable size limits

4. **Phase 4: MCP Integration**
   - Add `cdn_url` to artifact responses
   - Configuration for CDN base URL
   - Conditional inclusion (only if CDN configured)

## Dependencies

- Existing: `007-session-artifact-cache` (S3 artifact storage)
- Existing: AWS SDK v3 (already installed)
- New: LRU cache library (if not using simple Map)
- Existing: k3s cluster with MinIO

## Security Considerations

- No authentication (LAN-only, trusted network assumption)
- Rate limiting may be needed for abuse prevention
- No HTTPS (nginx/traefik terminates TLS)
- Consider adding optional API key for additional security
