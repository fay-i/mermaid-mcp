# Plan: Concurrent Client Connections Without Crashing

## Dependencies / Coordination

Gate run 2026-10-22. `git worktree list` shows only `main` and this worktree; `gh pr list --state open` is empty. Every sibling spec has merged to `main`, so nothing is in flight.

- spec 001-mcp-hello-world: independent (merged). It set up the stdio entry point that AC-16 must keep unchanged.
- spec 002-mermaid-to-svg: independent (merged).
- spec 003-mermaid-to-pdf: independent (merged).
- spec 007-session-artifact-cache: independent (merged). It is prior art: it introduced `extractSessionId` and assumed the transport would supply `extra.sessionId`, which never happened behind the gateway. Its `CacheManager` is not wired into `src/index.ts`, and this feature should not revive it.
- spec 008-cdn-artifact-proxy: independent (merged). Its standalone HTTP server is the only HTTP-server precedent in the codebase. The container never starts it (see Relevant Code).
- spec 009-pdf-deck-builder: independent (merged).
- spec 010-local-disk-storage: independent (merged). It owns the storage factory and env config that the deploy files must match.
- **User decision**: no turn forced; there are no overlaps or unmerged dependencies.

## Evidence Gathered From the Live Cluster (read-only, 2026-10-22)

- The pod has restarted 3,211 times (3,207 when the spec was written). `kubectl logs --previous` shows the exact crash from the spec: `New SSE connection` → `Already connected to a transport` at `stdioToSse.js:58` → exit 1. This session's own `mermaid-mcp` client got `ECONNREFUSED` while this research was running.
- Installed in the image: supergateway **3.4.3**, MCP SDK **1.29.0**. The Dockerfile installs supergateway **unpinned** (`npm install -g supergateway`). Its latest release is **4.2.0**, modified 2026-10-19, so the next image build would silently pick up a new major version.
- The live pod uses **S3 storage**: `STORAGE_TYPE=s3`, `S3_BUCKET=mermaid`, `S3_ENDPOINT=http://10.42.1.100:9000` (MinIO). These come from `envFrom: secretRef: mermaid-s3-credentials`, which **the repo's `k8s/deployment.yaml` does not contain**.
- `kubectl diff -k k8s/` against the live cluster shows the drift. Live has the `envFrom` secret ref, which the repo lacks. The repo has `imagePullSecrets: dockerhub-credentials` and extra labels, which live lacks. The `dockerhub-credentials` secret does not exist in the namespace; the image pulls anyway because it is public.
- The pod runs as `uid=1000(node)` (the manifest sets `runAsUser: 1000`). `/app/data/artifacts` is owned by the image's system user `mcp` with mode 755, so **uid 1000 cannot write it**. Applying `k8s/` exactly as committed would drop the S3 secret and fall back to local storage, and `LocalStorageBackend.initialize()` validates write access. The likely result is that the server exits at startup. Not run live: inferred from code and permissions.

## Existing Patterns

- **Server factory**: `createServer(storage)` in `src/index.ts:113` builds a fresh `McpServer` with all four tools registered. A server that needs one SDK server per session can reuse it unchanged.
- **Session plumbing already exists**: `registerStorageTool` (`src/index.ts:77`) passes `extractSessionId(extra)` to every storage tool. Each tool falls back to `randomUUID()` when the value is undefined (`src/tools/mermaid-to-svg.ts:623`, `src/tools/mermaid-to-deck.ts:403`, and the PDF equivalent). Under stdio it is always undefined, which is why separation today is per call.
- **Storage keys are `<sessionId>/<artifactId>.<ext>`** in both backends (`src/storage/s3-backend.ts:124`, `src/cache/storage.ts:80`). The S3 backend calls `validateUUID(sessionId, "sessionId")`, so **a session ID that is not a UUID would make every S3 store fail**.
- **Plain `node:http` servers, no framework**: `src/cdn-proxy/index.ts` uses `http.createServer` with a hand-rolled router, health handler, structured JSON logs, and a `SIGTERM` handler.
- **Main-module guard**: `src/index.ts` runs `main()` only when executed directly, so tests import `createServer` without starting a transport.
- **HTTP behavior tests on an ephemeral port**: the `tests/behavior/cdn-proxy/*` tests start an `http.createServer` on port 0 and assert over real HTTP.
- **Process-level tests**: `tests/behavior/server.test.ts` spawns `node dist/index.js` and asserts on process liveness and exit codes.
- **Integration tests**: `scripts/integration-test.sh` drives the MCP Inspector CLI against `node dist/index.js $TEMP_DIR` over stdio only.

## Relevant Code

- `Dockerfile:79-82`: `EXPOSE 8000` and the supergateway stdio→SSE `CMD` with `--healthEndpoint /health`. This is the root of the crash.
- `src/index.ts`: `parseArgs` (positional data dir; `--help` text lists env vars), `createServer`, and `main()`, which hard-codes `StdioServerTransport`. `main()` honours only `STORAGE_TYPE === "s3"`. Any other value, including the compose file's `auto`, builds a local backend from the CLI argument with `urlScheme: "file"`, which ignores `LOCAL_URL_SCHEME`/`CDN_*`.
- `src/cache/session.ts`: `extractSessionId` reads `extra.sessionId`. The installed SDK sets that field from `transport.sessionId` (`sdk/dist/esm/shared/protocol.js:320`), and the stdio transport has none.
- `src/storage/s3-backend.ts`: requires a UUID session and returns presigned URLs. Expiry comes from `S3_PRESIGNED_URL_EXPIRY` and defaults to 3600 s (`src/storage/config.ts`). In the cluster, "artifact URLs still resolve" means *within the presign window*.
- `src/storage/local-backend.ts`: returns `file://` URLs from `hostPath`. These resolve only on a machine that can see that path, which a remote client cannot.
- `src/renderer/browser.ts`: launches Chromium **per render** and closes it afterwards. Idle sessions hold no browser, but concurrent renders each launch one, and the pod limit is 2 Gi.
- `k8s/deployment.yaml`, `k8s/service.yaml`: port names are `sse`; Service is LoadBalancer `8100 → 8000` on 10.42.1.81 (and other node IPs); probes are `GET /health` on 8000.
- `docker-compose.yml`: publishes 8000 (labelled "SSE endpoint") and 3001 (the CDN proxy, which the image's `CMD` never starts). It sets `STORAGE_TYPE=auto`, `LOCAL_URL_SCHEME`, `CDN_*` and `MERMAID_S3_*`, which `main()` ignores. `src/storage/config.ts` reads `S3_ENDPOINT`/`S3_BUCKET`, while `src/storage/s3-config.ts` reads `MERMAID_S3_*`. The healthcheck curls `/health`.
- `README.md`: the stdio `npx` config (AC-16) and the "Docker Compose (Recommended)" section. There are no remote-client instructions today.
- `.github/workflows/ci.yml`: `docker` job builds and pushes `michaelfay/mermaid-mcp:latest` and `:<sha>` on push to `main`. The deployment uses `:latest` with `imagePullPolicy: Always`, so a rollout needs `kubectl apply -k k8s/` plus `kubectl -n mermaid-mcp rollout restart deploy/mermaid-mcp` when the manifest is unchanged.

## Reference Snippets

```ts
// src/index.ts:113: already a per-call factory, so one server per session costs nothing extra
export function createServer(storage: StorageBackend): McpServer {
  const server = new McpServer({
    name: "mermaid-printer",
    version: VERSION,
  });
```

```ts
// src/index.ts:96: every storage tool already receives the transport's session
    async (params: Record<string, unknown>, extra?: RequestHandlerExtra) => {
      const input = schema.parse(params);
      const sessionId = extractSessionId(extra);
      const result = await handler(input, storage, sessionId);
```

```ts
// src/tools/mermaid-to-svg.ts:623: today's per-call fallback
  const artifactSessionId = sessionId ?? randomUUID(); // Generate default session if not provided
```

```ts
// src/storage/s3-backend.ts:116,124: session must be a UUID
    validateUUID(sessionId, "sessionId");
      const key = `${sessionId}/${artifactId}.${extension}`;
```

```ts
// tests/behavior/cdn-proxy/health-check.test.ts:23: ephemeral-port HTTP test pattern
    const server = http.createServer(handler);
    server.listen(0, () => {
```

```dockerfile
# Dockerfile:82: the crashing entry point
CMD ["supergateway", "--stdio", "node dist/index.js /app/data/artifacts", "--port", "8000", "--healthEndpoint", "/health"]
```

## External Constraints

- **MCP 2025-11-25, Streamable HTTP**: there is one MCP endpoint for POST and GET. The server MAY assign `MCP-Session-Id` at initialize and SHOULD answer 400 to non-initialize requests without one. After it ends a session it MUST answer 404 for that ID, and clients MUST re-initialize on 404. Clients SHOULD send DELETE to end a session. These rules cover AC-14, AC-15 and the edge cases.
- **The spec's security warning**: servers **MUST validate the `Origin` header** and answer 403 when it is present and invalid. Authentication is a SHOULD and is out of scope here.
- **HTTP+SSE (2024-11-05) is deprecated.** Keeping old clients working would mean hosting the old endpoints too; the owner chose not to (Q1).
- **Claude Code**: `claude mcp add --transport http <name> <url>` is the recommended form, and `--transport sse` is documented as deprecated. `claude mcp remove <name>` (add `--scope user` if the name exists in several scopes) removes the old entry.
- **SDK 1.29.0 (installed; latest 1.x is 1.32.1)**: `StreamableHTTPServerTransport` supports `sessionIdGenerator`, `onsessioninitialized`, `onsessionclosed`, and opt-in `enableDnsRebindingProtection` with `allowedHosts`/`allowedOrigins`. It rejects unknown session IDs with 404. One `Server` connects to one transport, which is the error in the crash, so a stateful server needs one SDK server per session.
- **supergateway stateful Streamable HTTP** (read from the 4.2.0 source, `dist/gateways/statefulSessions.js`): it **spawns one child process per session**, has an optional `--sessionTimeout` reaper, defaults the path to `/mcp`, and answers 404 for unknown session IDs.

## Current Landscape Recommendations

- **Research date**: 2026-10-22
- **Sources checked**:
  - [MCP spec 2025-11-25, Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports): session, 404/400, Origin, and backwards-compatibility rules
  - [Claude Code MCP docs](https://code.claude.com/docs/en/mcp): `--transport http` recommended, SSE deprecated, `claude mcp remove`
  - [supergateway README](https://github.com/supercorp-ai/supergateway) and the published 4.2.0 package source: flags, default `/mcp`, per-session child processes
  - [TypeScript SDK v1.x server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md): stateful sessions; close idle sessions and cap open ones; DNS-rebinding guidance
  - Installed SDK source (`node_modules/@modelcontextprotocol/sdk` 1.29.0): `extra.sessionId` comes from `transport.sessionId`, and the transport's options

- **Recommendations**:
  1. **Serve Streamable HTTP from the server itself, with one SDK server per session (recommended).** Add an HTTP mode to the existing binary alongside the default stdio mode. It keeps a map of session ID to transport, gives each new session its own `createServer(storage)` with a stateful `StreamableHTTPServerTransport` whose `sessionIdGenerator` is `randomUUID`, removes the entry on close or idle timeout, and answers `/health` itself.
     - *Why this one*: it is the only option that satisfies **AC-7** as you confirmed it (Q2: one session per connection). The SDK puts the session ID on `extra.sessionId`, and the plumbing from spec 007 already routes it into storage keys with **no tool changes**. UUID IDs pass the S3 backend's `validateUUID`. It also runs as one process sharing one storage backend.
     - *Smallest-change fit*: it reuses `createServer`, the `node:http` precedent in `cdn-proxy`, and the SDK already in `dependencies`. It also removes supergateway from the image, deleting an unpinned global install that is about to jump a major version.
     - *Cost*: a small new HTTP entry path (session map, routing, idle reaper, shutdown) plus behavior tests for it. That is new code, but every line maps to an AC.
  2. **Alternative: supergateway `--outputTransport streamableHttp --stateful --sessionTimeout <ms>`.**
     - *Pros*: no application code; only Dockerfile and docs change.
     - *Cons*: the child processes still talk stdio, so **`extra.sessionId` stays undefined and AC-7 fails**: artifacts keep separating per call. Each session also costs a whole Node process, the gateway stays an unpinned external dependency on a version released 3 days ago, and its behavior is tested by someone else.
     - *Verdict*: acceptable only if AC-7 is dropped, which contradicts your Q2 answer.
  3. **Make session IDs UUIDs** (`randomUUID`), whichever option is chosen. Anything else breaks S3 stores at `validateUUID`.
  4. **Idle reaping and graceful close.**
     - Reap sessions with no requests for an idle period (Q3). Closing the transport makes later requests with that ID get 404, which tells MCP clients to re-initialize.
     - Honour client DELETE.
     - On `SIGTERM`, close every transport before exiting so pod rollouts don't leave sockets hanging.
  5. **Validate `Origin`** to meet the spec's MUST: reject any request that carries an `Origin` header not on an allowlist. Claude Code and the Inspector CLI do not send `Origin`; browsers do. This is a small change and stops a web page from driving the server through a user's browser. See Scope notes.
  6. **Bring `k8s/` in line with the live cluster so it can be applied as-is (AC-11)**:
     - add `envFrom: secretRef: mermaid-s3-credentials`; only the name goes in the repo, never the contents
     - rename the `sse` port names
     - decide on the missing `dockerhub-credentials` pull secret (Open Questions)
     - keep probes on `/health`
  7. **Test at the right level**:
     - Vitest behavior tests start the HTTP mode on port 0 and drive it with the SDK's own `Client` + `StreamableHTTPClientTransport`. They cover sequential clients (AC-1), abrupt drops (AC-2), concurrent and overlapping calls (AC-3/4), one client leaving (AC-5), session grouping and separation (AC-6/7), unknown sessions (AC-15), the old `/sse` path (AC-14) and `/health` under load (AC-10).
     - Keep the existing Inspector stdio suite unchanged as the AC-16 guard.
     - Add one Inspector smoke test over HTTP if the Inspector CLI accepts a URL target (verify during implementation).
     - The Inspector CLI is single-shot, so it cannot express multi-client scenarios.
  8. **Docs**: one README section for remote clients that names the transport (`http`), path and port, and gives the exact re-add commands for the known client. With the current Service and path `/mcp`:
     - `claude mcp remove --scope user mermaid-mcp`
     - `claude mcp add --scope user --transport http mermaid-mcp http://10.42.1.81:8100/mcp`

     Update the compose comments and healthcheck to match.

- **Cautions / avoid for now**:
  - **Don't migrate to the SDK v2 split packages** (`@modelcontextprotocol/server` 2.0.0, which supergateway 4.x uses). 1.29 has everything needed, and a major SDK migration is a separate concern.
  - **Don't keep the old SSE endpoint as a compatibility shim.** The spec allows it, but it doubles the transport surface and contradicts Q1.
  - **Don't add Express just for routing.** The codebase already has a `node:http` precedent. Express is a transitive dependency of the SDK, but importing it directly would add a declared dependency for two routes.
  - **Don't add resumability (event stores).** Nothing in the spec needs `Last-Event-ID` replay.
  - **Concurrent renders each launch Chromium.** Several clients rendering at once raise peak memory against the 2 Gi limit. A render concurrency cap would add scope; measure under AC-3/4 before adding one.
  - **Rebuilding the image as it stands now would pull supergateway 4.2.0.** If supergateway stays in any form (option 2), pin it.

- **Scope notes** (need your call before they carry forward):
  - *Origin validation* (Rec 5): the protocol requires it and it costs a few lines, but the spec rules auth out and says nothing about Origin. Proposed: include it.
  - *Compose and env drift*: `STORAGE_TYPE=auto`, `LOCAL_URL_SCHEME`, `CDN_*` and `MERMAID_S3_*` in `docker-compose.yml` are ignored by `main()`, and port 3001 serves nothing. Fixing storage selection is a separate concern from spec 010. Proposed: limit this feature to the compose file's transport, port, healthcheck and comments, and file an issue for the storage/env drift.
  - *Remote reachability of local-mode URLs*: `file://` URLs never resolved for remote clients, even before this change. AC-8/9 hold "as today", meaning the file exists where the URL says. Proposed: out of scope, noted in the same follow-up issue.

- **Unavailable research**: none. Still to check during implementation: whether the MCP Inspector CLI in use accepts an HTTP URL target (`--transport http`).

## Open Questions

- **Q**: Which transport approach?
  **Proposed**: Recommendation 1 (native Streamable HTTP in the server). Option 2 cannot meet AC-7 as confirmed.
- **Q**: How is HTTP mode selected while stdio stays the default (AC-16)?
  **Proposed**: an explicit opt-in on the existing binary, either a CLI flag or an env var such as a port. With no opt-in, behavior is exactly today's stdio mode. The Dockerfile `CMD` opts in. The behaviors phase picks the exact spelling.
- **Q**: Endpoint path and port?
  **Proposed**: `/mcp` (the spec's example, supergateway's default and the common convention) on container port 8000, keeping Service `8100 → 8000`. The client URL becomes `http://10.42.1.81:8100/mcp`. `/sse` and `/message` stop existing and return 404 (AC-14).
- **Q**: Idle session timeout?
  **Proposed**: 30 minutes without requests, as a constant unless a test needs it injectable. Clients that idle longer get 404 and re-initialize (spec MUST). Already-stored artifacts are untouched.
- **Q**: The `imagePullSecrets: dockerhub-credentials` entry references a secret that doesn't exist in the cluster.
  **Proposed**: remove it from `k8s/deployment.yaml`; the image is public and pulls without it. Keep it only if you plan to make the image private.
- **Q**: Should the image keep declaring the `/app/data/artifacts` volume and local-storage default when the cluster uses S3?
  **Proposed**: yes, for compose users, unchanged. The uid-1000 write-permission problem only bites if the cluster falls back to local storage. Mention it in the follow-up issue rather than fix it here.
- **Q**: How does the deployed pod come from the repo (AC-11)?
  **Proposed**: after merge, CI publishes `:latest`. Then run `kubectl apply -k k8s/` and `kubectl -n mermaid-mcp rollout restart deploy/mermaid-mcp`. Verify with `kubectl diff -k k8s/` (only server-managed fields differ), the restart count staying flat across multiple client connections, and the re-added Claude Code client working.

## Post-Merge Live Verification (B024, B027)

Run against the live cluster after CI publishes `:latest` from `main`, and record the results in the PR:

1. If the secret is missing, create it as the README shows (`kubectl -n mermaid-mcp create secret generic mermaid-s3-credentials …`).
2. `kubectl apply -k k8s/`, then `kubectl -n mermaid-mcp rollout restart deploy/mermaid-mcp`.
3. `kubectl diff -k k8s/` shows only server-managed fields.
4. Note the pod's restart count. Run 20 sequential connections and one abrupt drop, then confirm the count is unchanged.
5. B027: `claude mcp remove --scope user mermaid-mcp`, then `claude mcp add --scope user --transport http mermaid-mcp http://10.42.1.81:8100/mcp`. `claude mcp list` shows it connected, and each of the four tools succeeds.
