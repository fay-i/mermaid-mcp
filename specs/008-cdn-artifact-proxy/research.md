# Research: CDN Artifact Proxy

**Feature Branch**: `008-cdn-artifact-proxy`
**Date**: 2026-01-02
**Status**: Complete

This document resolves all "NEEDS CLARIFICATION" items from the plan's Technical Context and documents technology decisions.

---

## Research Tasks

### 1. LRU Cache Library Selection

**Question**: Which LRU cache library should be used for in-memory artifact caching?

**Decision**: Use `lru-cache` version ^11.x

**Rationale**:
- Most popular LRU cache library for Node.js (30M+ weekly downloads)
- Built-in TypeScript support with generics
- Supports size-based limits via `maxSize` and `sizeCalculation`
- Supports TTL (time-to-live) with `ttl` option
- Battle-tested, maintained by npm core maintainer (Isaac Z. Schlueter)
- Memory-efficient: pre-allocates storage for optimal performance

**Alternatives Considered**:
- `quick-lru`: Simpler API but fewer features, no built-in size-based eviction
- `node-cache`: TTL-focused but no LRU eviction policy
- Custom `Map` with `setTimeout`: Manual management, error-prone

**Configuration Pattern**:
```typescript
import { LRUCache } from 'lru-cache';

interface CachedArtifact {
  content: Buffer;
  contentType: 'image/svg+xml' | 'application/pdf';
  size: number;
}

const cache = new LRUCache<string, CachedArtifact>({
  maxSize: 256 * 1024 * 1024, // 256MB
  sizeCalculation: (value) => value.size,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});
```

**Sources**:
- [lru-cache npm](https://www.npmjs.com/package/lru-cache)
- [lru-cache GitHub](https://github.com/isaacs/node-lru-cache)

---

### 2. AWS SDK v3 Streaming for S3 GetObject

**Question**: How to efficiently stream S3 content to HTTP responses?

**Decision**: Use `GetObjectCommand` with direct stream piping via `response.Body.pipe()`

**Rationale**:
- AWS SDK v3 returns a readable stream in `Body` property
- Direct piping avoids loading entire artifact into memory
- Works with Node.js built-in `http.ServerResponse`
- TypeScript support via `NodeJsClient` type from `@smithy/types`

**Implementation Pattern**:
```typescript
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { NodeJsClient } from '@smithy/types';

// Type-safe streaming client
const s3 = new S3Client({...}) as NodeJsClient<S3Client>;

async function streamArtifact(res: http.ServerResponse, bucket: string, key: string) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (response.Body) {
    res.setHeader('Content-Type', response.ContentType ?? 'application/octet-stream');
    res.setHeader('Content-Length', response.ContentLength ?? 0);
    response.Body.pipe(res);
  }
}
```

**Caching Strategy**:
- For artifacts <= 1MB: Buffer entirely and cache in LRU
- For artifacts > 1MB: Stream directly from S3 (no caching to avoid memory pressure)
- Cache key format: `{artifactId}.{extension}` (matches S3 key)

**Sources**:
- [AWS SDK v3 S3 Examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html)
- [AWS SDK v3 Streams Fix (2025)](https://benlimmer.com/blog/2025/05/09/aws-sdk-v3-nodejs-streams-shouldnt-be-this-hard/)
- [Using Streams with S3 GetObject](https://arpadt.com/articles/streams-with-s3-getobject)

---

### 3. Kubernetes Secrets as Environment Variables

**Question**: How to mount k3s secrets as environment variables in deployment?

**Decision**: Use `envFrom.secretRef` for clean environment variable injection

**Rationale**:
- Single-line configuration to import all secret keys
- Secret keys become environment variable names directly
- Consistent with existing S3 environment variable pattern (`MERMAID_S3_*`)
- No file mounting complexity

**Secret Definition** (`mermaid-s3-credentials.yaml`):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mermaid-s3-credentials
  namespace: mermaid-mcp
type: Opaque
stringData:
  MERMAID_S3_ENDPOINT: "http://minio.minio:9000"
  MERMAID_S3_BUCKET: "mermaid-artifacts"
  MERMAID_S3_ACCESS_KEY: "<access-key>"
  MERMAID_S3_SECRET_KEY: "<secret-key>"
  MERMAID_S3_REGION: "us-east-1"
```

**Deployment Reference**:
```yaml
spec:
  containers:
    - name: cdn-proxy
      envFrom:
        - secretRef:
            name: mermaid-s3-credentials
```

**Note**: Same secret used by both MCP server and CDN proxy deployments.

**Sources**:
- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [ConfigMaps and Secrets Examples (2025)](https://www.domsoria.com/en/2025/11/configmaps-and-secrets-in-kubernetes-examples-as-environment-variables-and-files/)

---

### 4. Node.js HTTP Server for Binary Streaming

**Question**: Should we use a framework (Express, Fastify) or native HTTP?

**Decision**: Use Node.js built-in `http` module

**Rationale**:
- No additional dependencies (minimize attack surface)
- Simple routing: only 2 endpoints (`/health`, `/artifacts/...`)
- Full control over streaming behavior
- Lower memory footprint than frameworks
- Consistent with project's minimal dependency philosophy

**Implementation Pattern**:
```typescript
import http from 'node:http';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    return handleHealth(req, res);
  }

  const match = url.pathname.match(/^\/artifacts\/([^/]+)\/([^/]+)\.(svg|pdf)$/);
  if (match && req.method === 'GET') {
    return handleArtifact(req, res, match[1], match[2], match[3]);
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
});
```

**Performance Considerations**:
- Use `pipeline` from `stream/promises` for proper error handling
- Set appropriate `Keep-Alive` headers for connection reuse
- Response streaming starts immediately (no buffering)

---

### 5. Cache Hit/Miss Metrics

**Question**: How to track cache hit/miss statistics without external dependencies?

**Decision**: Maintain in-memory counters exposed via health endpoint

**Rationale**:
- No external metrics system required
- Simple counters for hits, misses, evictions
- Exposed in `/health` response for monitoring
- Can be scraped by Prometheus if needed later

**Implementation**:
```typescript
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sizeBytes: number;
  entryCount: number;
}

// lru-cache exposes .size and .calculatedSize
// Manual hit/miss tracking in get wrapper
```

**Health Response Extension**:
```json
{
  "ok": true,
  "service": "cdn-proxy",
  "s3_connected": true,
  "cache": {
    "hits": 1234,
    "misses": 567,
    "hit_rate": 0.685,
    "size_bytes": 52428800,
    "entry_count": 42,
    "max_size_bytes": 268435456
  },
  "timestamp": "2026-01-02T12:00:00.000Z"
}
```

---

### 6. Concurrent Request Handling (Thundering Herd)

**Question**: How to handle concurrent requests for the same uncached artifact?

**Decision**: Implement request coalescing with in-flight request tracking

**Rationale**:
- Prevents multiple S3 requests for same artifact
- Reduces S3 load during cache cold-start
- Standard pattern for CDN/proxy services

**Implementation Pattern**:
```typescript
// Track in-flight requests
const inFlight = new Map<string, Promise<Buffer>>();

async function getArtifact(key: string): Promise<Buffer> {
  // Check cache first
  const cached = cache.get(key);
  if (cached) return cached.content;

  // Check if already fetching
  let pending = inFlight.get(key);
  if (pending) return pending;

  // Start fetch and track
  pending = fetchFromS3(key);
  inFlight.set(key, pending);

  try {
    const result = await pending;
    cache.set(key, { content: result, ... });
    return result;
  } finally {
    inFlight.delete(key);
  }
}
```

---

### 7. CDN URL Construction in MCP Tools

**Question**: How do MCP tools know the CDN proxy base URL?

**Decision**: Environment variable `MERMAID_CDN_BASE_URL`

**Rationale**:
- Consistent with existing configuration pattern
- Optional: tools work without CDN configured
- Easy to configure per-environment (dev, staging, prod)
- No auto-discovery complexity

**Configuration**:
```bash
# In MCP server environment
MERMAID_CDN_BASE_URL=http://cdn-proxy.mermaid-mcp:8101
```

**Tool Response Enhancement**:
```typescript
// In mermaid-to-svg.ts / mermaid-to-pdf.ts
const cdnBaseUrl = process.env.MERMAID_CDN_BASE_URL;
if (cdnBaseUrl && s3Result) {
  response.cdn_url = `${cdnBaseUrl}/artifacts/${s3Result.artifact_id}.${extension}`;
}
```

---

### 8. Docker Image Strategy

**Question**: Same image with different entrypoint or separate image?

**Decision**: Same Docker image with different entrypoint command

**Rationale**:
- Single build artifact reduces CI/CD complexity
- Shared dependencies (AWS SDK) already in image
- Different entry points: `node dist/index.js` vs `node dist/cdn-proxy/index.js`
- CDN proxy doesn't need Puppeteer/Chromium, but carrying it is acceptable

**Kubernetes Deployment**:
```yaml
# CDN Proxy deployment
spec:
  containers:
    - name: cdn-proxy
      image: michaelfay/mermaid-mcp:latest
      command: ["node", "dist/cdn-proxy/index.js"]
      ports:
        - containerPort: 8101
```

---

## Summary of Dependencies

| Dependency | Version | Purpose | Status |
|------------|---------|---------|--------|
| `lru-cache` | ^11.x | In-memory LRU caching | NEW |
| `@aws-sdk/client-s3` | ^3.962.0 | S3 GetObject streaming | Existing |
| `@smithy/types` | (transitive) | TypeScript stream types | Existing |
| Node.js `http` | built-in | HTTP server | Built-in |

---

## Key Design Decisions Summary

1. **LRU Cache**: `lru-cache` ^11.x with size-based eviction and TTL
2. **Streaming**: Direct S3-to-HTTP piping for large artifacts, cache small artifacts (<1MB)
3. **Kubernetes Secrets**: `envFrom.secretRef` for environment variable injection
4. **HTTP Server**: Native Node.js `http` module (no framework)
5. **Metrics**: In-memory counters exposed via `/health` endpoint
6. **Thundering Herd**: Request coalescing with in-flight tracking
7. **CDN URL**: Environment variable `MERMAID_CDN_BASE_URL` in MCP server
8. **Docker**: Same image, different entrypoint command
