# Implementation Plan: CDN Artifact Proxy

**Branch**: `008-cdn-artifact-proxy` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-cdn-artifact-proxy/spec.md`

## Summary

Add an HTTP proxy service that serves S3/MinIO-stored Mermaid artifacts over plain HTTP for LAN clients that cannot use S3 credentials directly. The service runs as a separate Node.js HTTP server (port 8101), authenticates with MinIO using Kubernetes secrets, and provides in-memory LRU caching with configurable TTL and size limits. MCP render tools will be enhanced to include a `cdn_url` field in responses when the proxy is configured.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24+ (ESM modules)
**Primary Dependencies**: `@aws-sdk/client-s3` ^3.962.0 (existing), `lru-cache` ^11.x (new), Node.js built-in `http` module
**Storage**: S3-compatible (MinIO) via existing `src/storage/s3-client.ts` patterns
**Testing**: Vitest (unit), MCP Inspector CLI (integration)
**Target Platform**: Linux container (k3s cluster), Kubernetes deployment
**Project Type**: Single project with additional entry point (`src/cdn-proxy/index.ts`)
**Performance Goals**: <500ms for cached content, <100ms health check response
**Constraints**: HTTP only (TLS at ingress), LAN-only access, no client authentication
**Scale/Scope**: Single replica, 256MB cache limit, 100 concurrent requests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Epistemic Humility | ✅ PASS | Will run all checks before commits |
| II. TDD by Behavior | ✅ PASS | Tests first for HTTP endpoints, caching, S3 streaming |
| III. CI-First Local Verification | ✅ PASS | Clean Slate Protocol required before push |
| IV. No Skips/Ignores/Bypasses | ✅ PASS | No exceptions planned |
| V. Type Policy | ✅ PASS | Strict types for implementation, pragmatic for tests |
| VI. Tool Contract Discipline | ✅ PASS | HTTP API contracts in OpenAPI, error codes defined |
| VII. PR Structure | ✅ PASS | One PR per user story as spec requires |
| VIII. Iteration Loop | ✅ PASS | 10-minute cycles with CI feedback |
| IX. CI in GitHub Actions | ✅ PASS | Same quality command as local |
| X. Local Gates | ✅ PASS | `npm run quality` before every push |
| XI. Task Derivation | ✅ PASS | Tasks derived from this plan via /speckit.tasks |

**Gate Result**: ✅ PASS — No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/008-cdn-artifact-proxy/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── cdn-proxy-api.yaml  # OpenAPI specification
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── cdn-proxy/           # NEW: CDN proxy service
│   ├── index.ts         # HTTP server entry point
│   ├── server.ts        # HTTP request handler
│   ├── cache.ts         # LRU cache wrapper
│   ├── config.ts        # Configuration loader
│   ├── health.ts        # Health check endpoint
│   └── types.ts         # TypeScript interfaces
├── storage/             # EXISTING: S3 client (shared)
│   ├── s3-config.ts
│   ├── s3-client.ts
│   └── index.ts
├── tools/               # EXISTING: MCP tools (modify for cdn_url)
│   ├── mermaid-to-svg.ts  # Add cdn_url to response
│   ├── mermaid-to-pdf.ts  # Add cdn_url to response
│   └── ...
└── index.ts             # EXISTING: MCP server entry point

tests/
├── behavior/
│   ├── cdn-proxy/       # NEW: CDN proxy behavior tests
│   │   ├── artifact-retrieval.test.ts
│   │   ├── health-check.test.ts
│   │   ├── caching.test.ts
│   │   └── error-handling.test.ts
│   └── ...              # EXISTING tests
└── fixtures/            # EXISTING test fixtures

k8s/
├── cdn-proxy/           # NEW: CDN proxy Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
├── secrets/             # NEW: Secret definitions (gitignored)
│   └── mermaid-s3-credentials.yaml.example
└── ...                  # EXISTING manifests
```

**Structure Decision**: Single project with additional entry point. The CDN proxy shares the S3 client with the MCP server but runs as a separate process. Same Docker image with different entrypoint command (`node dist/cdn-proxy/index.js`).

## Complexity Tracking

No violations requiring justification. The design follows minimal complexity:
- Single new entry point, not a separate package
- Reuses existing S3 client code
- Uses well-established `lru-cache` library
- Standard Node.js HTTP server (no framework)

---

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Epistemic Humility | ✅ PASS | Research completed, decisions documented |
| II. TDD by Behavior | ✅ PASS | Test files planned in project structure |
| III. CI-First Local Verification | ✅ PASS | Quickstart includes local testing steps |
| IV. No Skips/Ignores/Bypasses | ✅ PASS | No exceptions in design |
| V. Type Policy | ✅ PASS | All interfaces typed in data-model.md |
| VI. Tool Contract Discipline | ✅ PASS | OpenAPI contract defined in contracts/ |
| VII. PR Structure | ✅ PASS | 4 user stories = 4 PRs |
| VIII. Iteration Loop | ✅ PASS | Standard workflow applies |
| IX. CI in GitHub Actions | ✅ PASS | No new CI changes needed |
| X. Local Gates | ✅ PASS | `npm run quality` unchanged |
| XI. Task Derivation | ✅ PASS | Ready for /speckit.tasks |

**Post-Design Gate Result**: ✅ PASS — Ready for task generation.

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/008-cdn-artifact-proxy/plan.md` | ✅ Complete |
| Research Document | `specs/008-cdn-artifact-proxy/research.md` | ✅ Complete |
| Data Model | `specs/008-cdn-artifact-proxy/data-model.md` | ✅ Complete |
| API Contract | `specs/008-cdn-artifact-proxy/contracts/cdn-proxy-api.yaml` | ✅ Complete |
| Quickstart Guide | `specs/008-cdn-artifact-proxy/quickstart.md` | ✅ Complete |
| Task List | `specs/008-cdn-artifact-proxy/tasks.md` | Pending (`/speckit.tasks`) |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list from this plan.
