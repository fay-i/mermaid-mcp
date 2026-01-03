# Quickstart: CDN Artifact Proxy

**Feature Branch**: `008-cdn-artifact-proxy`

This guide covers running the CDN proxy locally for development and testing.

---

## Prerequisites

1. **Node.js 24+** installed
2. **MinIO** or S3-compatible storage running
3. **Existing artifacts** in S3 bucket (created by MCP render tools)

---

## Local Development Setup

### 1. Install Dependencies

```bash
# From repository root
npm install
npm run build
```

### 2. Configure Environment

Create a `.env.cdn-proxy` file (or export variables):

```bash
# Required: S3/MinIO connection
export MERMAID_S3_ENDPOINT="http://localhost:9000"
export MERMAID_S3_BUCKET="mermaid-artifacts"
export MERMAID_S3_ACCESS_KEY="minioadmin"
export MERMAID_S3_SECRET_KEY="minioadmin"
export MERMAID_S3_REGION="us-east-1"

# Optional: CDN proxy settings
export MERMAID_CDN_PORT="8101"
export MERMAID_CDN_CACHE_ENABLED="true"
export MERMAID_CDN_CACHE_MAX_SIZE_MB="256"
export MERMAID_CDN_CACHE_TTL_HOURS="24"
```

### 3. Start the CDN Proxy

```bash
# Load environment and run
source .env.cdn-proxy
node dist/cdn-proxy/index.js
```

Expected output:
```
CDN Proxy listening on port 8101
S3 connection verified
Cache enabled: max 256MB, TTL 24h
```

---

## Testing the Endpoints

### Health Check

```bash
curl http://localhost:8101/health | jq
```

Expected response:
```json
{
  "ok": true,
  "service": "cdn-proxy",
  "s3_connected": true,
  "cache": {
    "hits": 0,
    "misses": 0,
    "evictions": 0,
    "hit_rate": 0,
    "size_bytes": 0,
    "max_size_bytes": 268435456,
    "entry_count": 0
  },
  "uptime_seconds": 5,
  "timestamp": "2026-01-02T12:00:00.000Z"
}
```

### Retrieve an Artifact

First, create an artifact using the MCP server:

```bash
# Using MCP Inspector to create an SVG
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name mermaid_to_svg \
  --tool-arg code="graph TD; A-->B"
```

Then fetch via CDN proxy (replace with actual artifact ID from response):

```bash
# Fetch SVG artifact
curl -v http://localhost:8101/artifacts/<artifact-id>.svg > diagram.svg

# Fetch PDF artifact
curl -v http://localhost:8101/artifacts/<artifact-id>.pdf > diagram.pdf
```

---

## Running with Docker

### Build the Image

```bash
docker build -t mermaid-mcp:local .
```

### Run CDN Proxy Container

```bash
docker run -d \
  --name cdn-proxy \
  -p 8101:8101 \
  -e MERMAID_S3_ENDPOINT="http://host.docker.internal:9000" \
  -e MERMAID_S3_BUCKET="mermaid-artifacts" \
  -e MERMAID_S3_ACCESS_KEY="minioadmin" \
  -e MERMAID_S3_SECRET_KEY="minioadmin" \
  -e MERMAID_S3_REGION="us-east-1" \
  -e MERMAID_CDN_PORT="8101" \
  mermaid-mcp:local \
  node dist/cdn-proxy/index.js
```

---

## Kubernetes Deployment

### 1. Create the Secret

```bash
kubectl create secret generic mermaid-s3-credentials \
  --namespace mermaid-mcp \
  --from-literal=MERMAID_S3_ENDPOINT="http://minio.minio:9000" \
  --from-literal=MERMAID_S3_BUCKET="mermaid-artifacts" \
  --from-literal=MERMAID_S3_ACCESS_KEY="<access-key>" \
  --from-literal=MERMAID_S3_SECRET_KEY="<secret-key>" \
  --from-literal=MERMAID_S3_REGION="us-east-1"
```

### 2. Apply Kustomization

```bash
kubectl apply -k k8s/cdn-proxy/
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -n mermaid-mcp -l app.kubernetes.io/name=cdn-proxy

# Check service
kubectl get svc -n mermaid-mcp cdn-proxy

# Test health endpoint (from within cluster)
kubectl run curl --rm -it --image=curlimages/curl -- \
  curl http://cdn-proxy.mermaid-mcp:8101/health
```

---

## Configuration Reference

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MERMAID_S3_ENDPOINT` | (required) | S3/MinIO endpoint URL |
| `MERMAID_S3_BUCKET` | (required) | Artifact storage bucket |
| `MERMAID_S3_ACCESS_KEY` | (required) | S3 access key |
| `MERMAID_S3_SECRET_KEY` | (required) | S3 secret key |
| `MERMAID_S3_REGION` | `us-east-1` | S3 region |
| `MERMAID_CDN_PORT` | `8101` | HTTP server port |
| `MERMAID_CDN_CACHE_ENABLED` | `true` | Enable in-memory caching |
| `MERMAID_CDN_CACHE_MAX_SIZE_MB` | `256` | Maximum cache size in MB |
| `MERMAID_CDN_CACHE_TTL_HOURS` | `24` | Cache entry TTL in hours |
| `MERMAID_CDN_CACHE_THRESHOLD_MB` | `1` | Only cache artifacts smaller than this |

---

## MCP Tool Integration

To enable `cdn_url` in MCP tool responses, set the base URL in the MCP server environment:

```bash
# In MCP server container/process
export MERMAID_CDN_BASE_URL="http://cdn-proxy.mermaid-mcp:8101"
```

Tool responses will then include:
```json
{
  "ok": true,
  "artifact_id": "123e4567-e89b-12d3-a456-426614174000",
  "download_url": "http://minio:9000/...",
  "cdn_url": "http://cdn-proxy.mermaid-mcp:8101/artifacts/123e4567-e89b-12d3-a456-426614174000.svg"
}
```

---

## Troubleshooting

### S3 Connection Fails

1. Verify MinIO is running: `curl http://localhost:9000/minio/health/live`
2. Check credentials match MinIO configuration
3. Ensure bucket exists: `mc ls local/mermaid-artifacts`

### Cache Not Working

1. Check `MERMAID_CDN_CACHE_ENABLED` is `true`
2. Verify artifact size is below `MERMAID_CDN_CACHE_THRESHOLD_MB`
3. Monitor cache stats via `/health` endpoint

### 404 on Artifact Fetch

1. Verify artifact exists in S3: `mc ls local/mermaid-artifacts/<artifact-id>.svg`
2. Check artifact ID format (must be valid UUID)
3. Ensure correct extension (.svg or .pdf)
