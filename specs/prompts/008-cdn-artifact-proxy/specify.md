# CDN Artifact Proxy — Specify Prompt

Feature: CDN Artifact Proxy

Add an HTTP proxy service that serves cached S3 artifacts over plain HTTP for LAN clients that cannot use S3 credentials directly.

## Problem

Currently, the MCP server stores rendered artifacts in MinIO S3 and returns presigned URLs. However:

1. Most LAN machines cannot use MinIO S3 credentials directly (security restrictions, client limitations)
2. Presigned URLs require the client to access MinIO directly, which may not be reachable
3. There's no simple HTTP endpoint for artifact retrieval without S3 SDK/credentials

## Solution

1. Add an HTTP proxy service that runs alongside the MCP server
2. Proxy serves artifacts from MinIO S3 using credentials from k3s secrets
3. Clients access artifacts via simple HTTP GET requests (no authentication required for LAN)
4. The proxy handles S3 authentication transparently

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LAN Clients   │────▶│   CDN Proxy     │────▶│   MinIO S3      │
│  (HTTP only)    │     │  (HTTP :8101)   │     │  (with creds)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │ Uses k3s secret:
        │                       │ mermaid-s3-credentials
        │                       │
        ▼                       ▼
   GET /artifacts/         S3 GetObject with
   <artifact_id>.svg       AWS credentials
```

## Key Behaviors

- HTTP-only service (nginx reverse proxy can add HTTPS if needed)
- Runs on port 8101 (configurable)
- Reads S3 credentials from k3s secret `mermaid-s3-credentials`
- Path format: `GET /artifacts/<session_id>/<artifact_id>.<ext>`
- Returns artifact content with appropriate `Content-Type` headers
- Caches responses in-memory for performance (optional, configurable)
- No authentication required (LAN-only, trusted network)
- Health endpoint: `GET /health`

## API Endpoints

### GET /artifacts/:sessionId/:artifactId.:ext

Retrieves an artifact from S3 and serves it over HTTP.

**Path Parameters:**
- `sessionId`: The session ID that owns the artifact
- `artifactId`: The artifact UUID
- `ext`: File extension (svg, pdf)

**Response Headers:**
- `Content-Type`: `image/svg+xml` or `application/pdf`
- `Content-Length`: Size in bytes
- `Cache-Control`: `public, max-age=3600` (configurable)
- `X-Artifact-Id`: The artifact ID
- `X-Session-Id`: The session ID

**Success Response (200):**
Raw artifact content (SVG XML or PDF binary)

**Error Responses:**
- `404 Not Found`: Artifact does not exist in S3
- `502 Bad Gateway`: S3 connection failed
- `503 Service Unavailable`: S3 credentials not configured

### GET /health

Health check endpoint.

**Success Response (200):**
```json
{
  "ok": true,
  "service": "cdn-proxy",
  "s3_connected": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Kubernetes Integration

### New Secret: mermaid-s3-credentials

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mermaid-s3-credentials
  namespace: mermaid-mcp
type: Opaque
stringData:
  endpoint: "http://minio.minio.svc.cluster.local:9000"
  bucket: "mermaid-artifacts"
  access-key: "<minio-access-key>"
  secret-key: "<minio-secret-key>"
  region: "us-east-1"
```

### Deployment Updates

The CDN proxy can be:
1. **Option A**: A sidecar container in the existing mermaid-mcp pod
2. **Option B**: A separate deployment with its own service

Recommendation: Option B (separate deployment) for independent scaling and updates.

### New Service: mermaid-cdn

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mermaid-cdn
  namespace: mermaid-mcp
spec:
  type: LoadBalancer
  ports:
    - port: 8101
      targetPort: 8101
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: mermaid-cdn
```

## Configuration

Environment variables (loaded from k3s secret):

| Variable | Source | Description |
|----------|--------|-------------|
| `CDN_PORT` | ConfigMap | HTTP port (default: 8101) |
| `CDN_S3_ENDPOINT` | Secret | MinIO endpoint URL |
| `CDN_S3_BUCKET` | Secret | S3 bucket name |
| `CDN_S3_ACCESS_KEY` | Secret | S3 access key |
| `CDN_S3_SECRET_KEY` | Secret | S3 secret key |
| `CDN_S3_REGION` | Secret | S3 region (default: us-east-1) |
| `CDN_CACHE_ENABLED` | ConfigMap | Enable in-memory cache (default: true) |
| `CDN_CACHE_MAX_SIZE_MB` | ConfigMap | Max cache size in MB (default: 512) |
| `CDN_CACHE_TTL_SECONDS` | ConfigMap | Cache TTL (default: 3600) |

## Updated MCP Response

When the CDN proxy is available, the MCP tools should return an additional `cdn_url` field:

```json
{
  "ok": true,
  "request_id": "uuid",
  "artifact": {
    "artifact_id": "uuid",
    "s3_url": "https://minio.example.com/bucket/session/artifact.svg",
    "cdn_url": "http://mermaid-cdn.local:8101/artifacts/session/artifact.svg",
    "content_type": "image/svg+xml",
    "size_bytes": 12345
  }
}
```

## Constraints

- HTTP only (no TLS termination - nginx/traefik handles that)
- LAN access only (no public internet exposure)
- Stateless service (no persistent storage needed)
- Must work with existing MinIO setup
- Credentials loaded from k3s secrets only (not environment files)

## Error Codes

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| 404 | `ARTIFACT_NOT_FOUND` | Artifact does not exist in S3 |
| 400 | `INVALID_PATH` | Malformed artifact path |
| 502 | `S3_ERROR` | Failed to retrieve from S3 |
| 503 | `NOT_CONFIGURED` | S3 credentials not available |

## Acceptance Criteria

1. CDN proxy serves artifacts over HTTP without requiring S3 credentials on client
2. Artifacts accessible via simple URL path: `/artifacts/<session>/<id>.<ext>`
3. Correct `Content-Type` headers for SVG and PDF
4. Health endpoint returns S3 connection status
5. k3s deployment with secret-based credentials
6. In-memory caching reduces S3 load for repeated requests
7. Graceful error handling for missing artifacts and S3 failures
8. MCP tools include `cdn_url` in responses when CDN is configured

## Implementation Notes

- Use Node.js HTTP server (no Express dependency needed)
- AWS SDK v3 for S3 client (already a dependency)
- LRU cache for in-memory caching (consider `lru-cache` package)
- Separate Docker image or same image with different entrypoint
- Health check should verify S3 bucket accessibility
